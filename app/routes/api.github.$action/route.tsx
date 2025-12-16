import { type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/.server/service/auth';
import { errorResponse } from '~/.server/utils/api-response';
import { createScopedLogger } from '~/.server/utils/logger';
import { handleGitHubAuth, handleGitHubDisconnect } from './auth.server';
import { handleGitHubPush } from './push.server';
import { getGitHubRepos } from './repos.server';
import { getGitHubStats } from './stats.server';

const logger = createScopedLogger('api.github.route');

/**
 * 处理 GET 请求
 */
export async function loader(args: LoaderFunctionArgs) {
  const { request, params } = args;

  // 验证用户身份
  const authResult = await requireAuth(request, { isApi: true });
  if (authResult instanceof Response) {
    return authResult;
  }

  const userId = authResult.userInfo?.sub;
  if (!userId) {
    return errorResponse(401, '用户未登录');
  }

  // 根据 action 参数路由到不同的处理函数
  switch (params.action) {
    case 'repos':
      return getGitHubRepos({ request, userId });

    case 'stats':
      return getGitHubStats({ userId });

    default:
      return errorResponse(404, `未知的 API 操作: ${params.action}`);
  }
}

/**
 * 处理 POST/DELETE 请求
 */
export async function action(args: ActionFunctionArgs) {
  const { request, params } = args;

  // 验证用户身份
  const authResult = await requireAuth(request, { isApi: true });
  if (authResult instanceof Response) {
    return authResult;
  }

  const userId = authResult.userInfo?.sub;
  if (!userId) {
    return errorResponse(401, '用户未登录');
  }

  logger.debug('处理 GitHub API 请求', { action: params.action, method: request.method });

  // 根据 action 参数和 HTTP 方法路由到不同的处理函数
  if (request.method === 'DELETE') {
    switch (params.action) {
      case 'disconnect':
        return handleGitHubDisconnect({ userId });

      default:
        logger.warn('未知的 DELETE 操作', { action: params.action });
        return errorResponse(404, `未知的 API 操作: ${params.action}`);
    }
  }

  // POST 请求
  switch (params.action) {
    case 'auth':
      return handleGitHubAuth({ request, userId });

    case 'push':
      return handleGitHubPush({ request, userId });

    default:
      logger.warn('未知的 POST 操作', { action: params.action });
      return errorResponse(404, `未知的 API 操作: ${params.action}`);
  }
}
