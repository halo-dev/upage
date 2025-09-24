import { type LoaderFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/lib/.server/auth';
import { getUserPlatformDeploymentsWithPagination } from '~/lib/.server/deployment';
import { errorResponse, successResponse } from '~/utils/api-response';

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const authResult = await requireAuth(request, { isApi: true });
    if (authResult instanceof Response) {
      return authResult;
    }

    if (!authResult.userInfo) {
      return errorResponse(401, '无法获取用户信息');
    }

    const userId = authResult.userInfo.sub;
    if (!userId) {
      return errorResponse(401, '无效的用户ID');
    }

    const url = new URL(request.url);
    const platform = url.searchParams.get('platform') as any;
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);

    const result = await getUserPlatformDeploymentsWithPagination(userId, platform, limit, offset);

    return successResponse(result, '获取部署记录成功');
  } catch (error) {
    console.error('Error fetching deployment records:', error);
    return errorResponse(500, error instanceof Error ? error.message : '获取部署记录失败');
  }
}
