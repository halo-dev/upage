import type { LoaderFunctionArgs } from '@remix-run/node';
import { logto } from '~/lib/.server/auth';
import { checkErrorLoader } from './check-error.server';
import { userLoader } from './user.server';

export const loader = async (args: LoaderFunctionArgs) => {
  const { params } = args;

  switch (params.action) {
    case 'check-error':
      return checkErrorLoader(args);
    case 'user':
      return userLoader(args);
    default:
      /**
       * 处理认证路由
       * 支持的路由:
       * - /api/auth/sign-in - 登录
       * - /api/auth/callback - 登录回调
       * - /api/auth/sign-out - 登出
       */
      return logto.handleAuthRoutes({
        'sign-in': {
          path: '/api/auth/sign-in',
          redirectBackTo: '/api/auth/callback',
        },
        'sign-in-callback': {
          path: '/api/auth/callback',
          redirectBackTo: '/',
        },
        'sign-out': {
          path: '/api/auth/sign-out',
          redirectBackTo: '/',
        },
        'sign-up': {
          path: '/api/auth/sign-up',
          redirectBackTo: '/api/auth/callback',
        },
      })(args);
  }
};
