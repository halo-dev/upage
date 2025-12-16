import { type ActionFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/.server/service/auth';
import { errorResponse } from '~/.server/utils/api-response';
import { createScopedLogger } from '~/.server/utils/logger';
import { uploadAsset } from './asset.server';

const logger = createScopedLogger('api.upload');

export async function action({ request, params }: ActionFunctionArgs) {
  const authResult = await requireAuth(request, { isApi: true });
  if (authResult instanceof Response) {
    return authResult;
  }
  const userId = authResult.userInfo?.sub;
  if (!userId) {
    return errorResponse(401, '用户未登录');
  }

  logger.debug('处理 Upload API 请求', { action: params.action });

  switch (params.action) {
    case 'asset':
      return uploadAsset({ request, userId });
    default:
      return errorResponse(404, '不支持该操作');
  }
}
