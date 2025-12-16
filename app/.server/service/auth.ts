import type { IdTokenClaims } from '@logto/node';
import { type LogtoContext, makeLogtoRemix } from '@logto/remix';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { createCookieSessionStorage, redirect } from '@remix-run/node';
import { createScopedLogger } from '~/.server/utils/logger';
import type { LogtoUser } from '~/types/logto';

const logger = createScopedLogger('auth.server');

/**
 * 认证相关类型定义
 */
interface LogtoConfig {
  endpoint: string;
  appId: string;
  appSecret: string;
  baseUrl: string;
  scopes?: string[];
}

interface MockUser extends Pick<LogtoContext, 'isAuthenticated' | 'userInfo' | 'claims'> {}

/**
 * 虚拟用户接口，与 MockUser 类似但代表真实存在于 logto 的用户
 */
interface VirtualUser extends Pick<LogtoContext, 'isAuthenticated' | 'userInfo' | 'claims'> {
  isVirtual: true;
}

// Logto路由配置类型
interface LogtoRoutes {
  'sign-in': { path: string; redirectBackTo: string };
  'sign-in-callback': { path: string; redirectBackTo: string };
  'sign-out': { path: string; redirectBackTo: string };
  'sign-up': { path: string; redirectBackTo: string };
}

/**
 * 公共 Cookie 配置基础
 */
const baseCookieOptions = {
  httpOnly: true,
  path: '/',
  sameSite: 'lax' as const,
  secrets: [process.env.LOGTO_COOKIE_SECRET || 's3cr3t'],
};

/**
 * 创建认证 session 存储
 */
const sessionStorage = createCookieSessionStorage({
  cookie: {
    ...baseCookieOptions,
    name: 'logto_session',
    maxAge: 60 * 60 * 24 * 30, // 30 天过期
  },
});

/**
 * 创建虚拟用户 session 存储
 */
const virtualUserStorage = createCookieSessionStorage({
  cookie: {
    ...baseCookieOptions,
    name: 'virtual_user',
    maxAge: 60 * 60 * 24 * 30,
  },
});

/**
 * 创建认证错误信息 session 存储
 */
const errorSessionStorage = createCookieSessionStorage({
  cookie: {
    ...baseCookieOptions,
    name: 'auth_error',
    maxAge: 60, // 1分钟后过期，错误信息不需要长期保存
  },
});

/**
 * 创建 Logto 配置
 */
const config: LogtoConfig = {
  endpoint: process.env.LOGTO_ENDPOINT || '',
  appId: process.env.LOGTO_APP_ID || '',
  appSecret: process.env.LOGTO_APP_SECRET || '',
  baseUrl: process.env.LOGTO_BASE_URL || 'http://localhost:5173',
  scopes: ['email', 'profile'],
};

// 创建原始 Logto 实例（私有，不直接导出）
const originalLogto = makeLogtoRemix(config, { sessionStorage });

export function shouldEnforceAuth(): boolean {
  return process.env.LOGTO_ENABLE === 'true';
}

function getMockDevUser(): MockUser {
  return {
    isAuthenticated: true,
    userInfo: {
      iss: 'https://mock.issuer.com',
      sub: 'mock-user-id',
      aud: 'mock-audience',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      name: 'Mock User',
      username: 'user',
      email: 'mock@example.com',
    },
  };
}

/**
 * 设置认证错误信息到会话中
 */
export async function setAuthError(errorMessage: string): Promise<string> {
  const session = await errorSessionStorage.getSession();
  session.set('authError', errorMessage);
  return errorSessionStorage.commitSession(session);
}

/**
 * 获取并清除认证错误信息
 */
export async function getAuthError(
  request: Request,
): Promise<{ errorMessage?: string; headers: { 'Set-Cookie': string } }> {
  const session = await errorSessionStorage.getSession(request.headers.get('Cookie'));
  const errorMessage = session.get('authError') as string | undefined;

  // 清除错误信息
  return {
    errorMessage,
    headers: {
      'Set-Cookie': await errorSessionStorage.destroySession(session),
    },
  };
}

/**
 * 增强版的 Logto 对象，添加错误处理和开发环境跳过
 */
export const logto = {
  ...originalLogto,

  /**
   * 增强版的 handleAuthRoutes 方法
   */
  handleAuthRoutes: (routes: LogtoRoutes) => {
    const originalHandler = originalLogto.handleAuthRoutes(routes);

    return async (args: LoaderFunctionArgs) => {
      try {
        // 特殊处理退出登录路由
        const { request } = args;
        const url = new URL(request.url);
        const path = url.pathname;

        // 如果是退出登录路由，检查是否是虚拟用户
        if (path === routes['sign-out'].path) {
          const virtualUser = await getVirtualUser(request);

          if (virtualUser?.isVirtual) {
            logger.info('虚拟用户退出登录');
            const clearCookie = await clearVirtualUser();
            return redirect(routes['sign-out'].redirectBackTo, {
              headers: {
                'Set-Cookie': clearCookie,
              },
            });
          }
        }
        return await originalHandler(args);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        logger.error(`认证服务错误: ${errorMessage}`);
        return handleAuthError(error, args);
      }
    };
  },

  getContext: originalLogto.getContext,
};

/**
 * 处理认证过程中的错误
 */
async function handleAuthError(error: unknown, args: LoaderFunctionArgs) {
  // 判断错误类型
  let errorMessage = '认证服务暂时不可用，请稍后再试';

  // 处理网络错误（认证服务器不可用）
  if (
    error instanceof Error &&
    (error.message.includes('fetch failed') ||
      error.message.includes('network') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('timeout'))
  ) {
    errorMessage = '无法连接到认证服务器，请检查网络连接';
  }
  // 其他类型的错误
  else if (error instanceof Error) {
    errorMessage = '登录服务出现异常，请稍后再试';
  }

  // 确定重定向URL
  const redirectUrl = determineRedirectUrl(args.request);

  // 生成带有错误信息的Cookie
  const cookie = await setAuthError(errorMessage);

  // 重定向回原始页面，同时携带错误会话Cookie
  return redirect(redirectUrl, {
    headers: {
      'Set-Cookie': cookie,
    },
  });
}

/**
 * 根据请求确定最合适的重定向URL
 */
function determineRedirectUrl(request: Request): string {
  // 默认重定向到首页
  const defaultUrl = '/';

  try {
    const url = new URL(request.url);
    const redirectTo = url.searchParams.get('redirectTo');

    if (redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//')) {
      // 确保只重定向到应用内部URL
      return redirectTo;
    }

    // 如果有referer头，也可以考虑使用它
    const referer = request.headers.get('referer');
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        // 确保是同一域名下的URL
        if (refererUrl.hostname === url.hostname) {
          return refererUrl.pathname + refererUrl.search;
        }
      } catch {
        // 忽略无效的referer
      }
    }
  } catch {
    // 如果URL解析失败，使用默认的根路径
  }

  return defaultUrl;
}

/**
 * 设置虚拟用户信息到 cookie
 * @param userInfo 用户信息
 * @returns cookie 字符串，可用于 HTTP 响应头
 */
export async function setVirtualUser(userInfo: LogtoUser): Promise<string> {
  const session = await virtualUserStorage.getSession();

  const virtualUserInfo = {
    id: userInfo.id,
    iss: process.env.LOGTO_ENDPOINT || 'https://auth.upage.io',
    sub: userInfo.id,
    aud: process.env.LOGTO_APP_ID || 'virtual-app',
    // 30天后过期
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
    iat: Math.floor(Date.now() / 1000),
    name: userInfo.name || null,
    email: userInfo.primaryEmail || null,
    phone_number: userInfo.primaryPhone || null,
    username: userInfo.username || null,
    picture: userInfo.avatar || null,
  } as IdTokenClaims;

  session.set('userInfo', virtualUserInfo);
  session.set('isAuthenticated', true);

  return virtualUserStorage.commitSession(session);
}

/**
 * 获取虚拟用户信息
 * @param request 请求对象
 * @returns 虚拟用户信息，如果不存在则返回 null
 */
export async function getVirtualUser(request: Request): Promise<VirtualUser | null> {
  const cookieHeader = request.headers.get('Cookie');
  const session = await virtualUserStorage.getSession(cookieHeader);

  const isAuthenticated = session.get('isAuthenticated');
  const userInfo = session.get('userInfo') as IdTokenClaims;

  if (!isAuthenticated || !userInfo) {
    return null;
  }

  // 验证用户信息是否有效
  const now = Math.floor(Date.now() / 1000);
  if (userInfo.exp && userInfo.exp < now) {
    // 用户信息已过期，清除 session
    await clearVirtualUser();
    return null;
  }

  // 获取上次验证时间
  const lastVerified = session.get('lastVerified') || 0;
  const verifyInterval = 60 * 60 * 1000;

  // 如果距离上次验证时间不足验证间隔，则跳过 Logto 验证
  if (now * 1000 - lastVerified < verifyInterval) {
    return {
      isAuthenticated: true,
      userInfo,
      isVirtual: true,
    };
  }

  try {
    // 更新验证时间
    session.set('lastVerified', Date.now());
    await virtualUserStorage.commitSession(session);

    return {
      isAuthenticated: true,
      userInfo,
      isVirtual: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error('验证虚拟用户失败:', errorMessage);
    return {
      isAuthenticated: true,
      userInfo,
      isVirtual: true,
    };
  }
}

/**
 * 清除虚拟用户信息
 * @returns cookie 字符串，用于清除虚拟用户 cookie
 */
export async function clearVirtualUser(): Promise<string> {
  const session = await virtualUserStorage.getSession();
  return virtualUserStorage.destroySession(session);
}

/**
 * 检查用户是否已认证，如果未认证，则重定向到登录页面
 */
export async function requireUser(request: Request) {
  const context = await getUser(request);

  if (!context.isAuthenticated) {
    return redirect('/api/auth/sign-in');
  }

  return context;
}

/**
 * 获取当前用户信息
 * 按优先级依次检查：
 * 1. 开发环境模拟用户
 * 2. 虚拟用户
 * 3. Logto 认证用户
 */
export async function getUser(request: Request) {
  // 首先检查是否为开发环境
  if (!shouldEnforceAuth()) {
    return getMockDevUser();
  }

  // 检查是否存在虚拟用户
  const virtualUser = await getVirtualUser(request);
  if (virtualUser) {
    return virtualUser;
  }

  // 继续原有的 logto 认证流程
  return await logto.getContext({
    fetchUserInfo: true,
    getAccessToken: true,
  })(request);
}

/**
 * 通用权限验证中间件
 * 用于API和页面路由的权限验证
 *
 * 返回json错误或重定向到登录页面
 */
export async function requireAuth(request: Request, options: { isApi?: boolean; redirectTo?: string } = {}) {
  const { isApi = false, redirectTo = '/api/auth/sign-in' } = options;

  const context = await getUser(request);

  if (!context.isAuthenticated) {
    if (isApi) {
      // API路由返回JSON错误
      return new Response(
        JSON.stringify({
          error: 'Unauthorized',
          message: '请先登录',
          code: 401,
        }),
        {
          status: 401,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );
    }

    // 页面路由重定向到登录页面
    return redirect(redirectTo);
  }

  return context;
}
