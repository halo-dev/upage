import { type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/.server/service/auth';
import { errorResponse } from '~/.server/utils/api-response';
import { createScopedLogger } from '~/.server/utils/logger';
import { handleNetlifyAuth } from './auth.server';
import { deletePage } from './delete.server';
import { handleDeploy } from './deploy.server';
import { getNetlifyStats } from './stats.server';
import { toggleAccess } from './toggle-access.server';

const logger = createScopedLogger('api.netlify.route');

export async function loader(args: LoaderFunctionArgs) {
  const { request, params } = args;
  const authResult = await requireAuth(request, { isApi: true });
  if (authResult instanceof Response) {
    return authResult;
  }

  const userId = authResult.userInfo?.sub;
  if (!userId) {
    return errorResponse(401, '用户未登录');
  }

  switch (params.action) {
    case 'stats':
      return getNetlifyStats({ userId });
    default:
      return errorResponse(404, `未知的 API 操作: ${params.action}`);
  }
}

export async function action(args: ActionFunctionArgs) {
  const { request, params } = args;
  const authResult = await requireAuth(request, { isApi: true });
  if (authResult instanceof Response) {
    return authResult;
  }

  const userId = authResult.userInfo?.sub;
  if (!userId) {
    return errorResponse(401, '用户未登录');
  }

  logger.debug('处理 Netlify API 请求', { action: params.action });

  switch (params.action) {
    case 'deploy':
      return handleDeploy({ ...args, userId });
    case 'auth':
      return handleNetlifyAuth({ request, userId });
    case 'toggle-access':
      return toggleAccess({ ...args, userId });
    case 'delete':
      return deletePage({ ...args, userId });
    default:
      logger.warn('未知的 API 操作', { action: params.action });
      return errorResponse(404, `未知的 API 操作: ${params.action}`);
  }
}
