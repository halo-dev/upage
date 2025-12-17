import { type LoaderFunctionArgs } from 'react-router';
import { requireAuth } from '~/.server/service/auth';
import { errorResponse } from '~/.server/utils/api-response';
import { getDeploymentByChat } from './get-by-chat.server';
import { getDeploymentStats } from './stats.server';

export async function loader({ request, params }: LoaderFunctionArgs) {
  const authResult = await requireAuth(request, { isApi: true });
  if (authResult instanceof Response) {
    return authResult;
  }

  const userId = authResult.userInfo?.sub;
  if (!userId) {
    return errorResponse(401, '用户未登录');
  }

  const url = new URL(request.url);
  const chatId = url.searchParams.get('chatId');
  const platform = url.searchParams.get('platform') as any;

  switch (params.action) {
    case 'stats':
      return getDeploymentStats({ userId });
    case 'get-by-chat':
      return getDeploymentByChat({ chatId: chatId || '', platform });
    default:
      return errorResponse(404, `未知的 API 操作: ${params.action}`);
  }
}
