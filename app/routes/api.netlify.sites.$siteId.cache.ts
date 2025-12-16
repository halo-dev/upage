import { type ActionFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/.server/service/auth';
import { getNetlifyConnectionSettings } from '~/.server/service/connection-settings';
import { errorResponse, successResponse } from '~/.server/utils/api-response';
import { createScopedLogger } from '~/.server/utils/logger';

const logger = createScopedLogger('api.netlify.sites.cache');

export async function action({ request, params }: ActionFunctionArgs) {
  const authResult = await requireAuth(request, { isApi: true });
  if (authResult instanceof Response) {
    return authResult;
  }

  const userId = authResult.userInfo?.sub;
  if (!userId) {
    return errorResponse(401, '用户未登录');
  }

  const { siteId } = params;
  if (!siteId) {
    return errorResponse(400, '缺少站点ID');
  }

  try {
    const connectionSettings = await getNetlifyConnectionSettings(userId);

    if (!connectionSettings) {
      return errorResponse(401, '未连接到Netlify，请先设置访问令牌');
    }

    const { token } = connectionSettings;

    const response = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/cache`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`清除站点缓存失败: ${response.status} ${errorText}`);
      return errorResponse(response.status, '清除站点缓存失败');
    }

    logger.info(`用户 ${userId} 成功清除了站点 ${siteId} 的缓存`);
    return successResponse({}, '站点缓存清除成功');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`清除站点缓存失败: ${errorMessage}`);
    return errorResponse(500, '清除站点缓存失败');
  }
}
