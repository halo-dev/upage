import { type LoaderFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/lib/.server/auth';
import { errorResponse } from '~/utils/api-response';
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

  switch (params.action) {
    case 'stats':
      return getDeploymentStats({ userId });
    default:
      return errorResponse(404, `未知的 API 操作: ${params.action}`);
  }
}
