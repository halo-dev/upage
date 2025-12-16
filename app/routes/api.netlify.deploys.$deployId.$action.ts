import { type ActionFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/.server/service/auth';
import { getNetlifyConnectionSettings } from '~/.server/service/connection-settings';
import { errorResponse, successResponse } from '~/.server/utils/api-response';
import { createScopedLogger } from '~/.server/utils/logger';

const logger = createScopedLogger('api.netlify.deploys');

export async function action({ request, params }: ActionFunctionArgs) {
  const authResult = await requireAuth(request, { isApi: true });
  if (authResult instanceof Response) {
    return authResult;
  }

  const userId = authResult.userInfo?.sub;
  if (!userId) {
    return errorResponse(401, '用户未登录');
  }

  const { deployId, action } = params;
  if (!deployId) {
    return errorResponse(400, '缺少部署ID');
  }

  if (!action || !['lock', 'unlock', 'publish'].includes(action)) {
    return errorResponse(400, '无效的操作');
  }

  try {
    const connectionSettings = await getNetlifyConnectionSettings(userId);

    if (!connectionSettings) {
      return errorResponse(401, '未连接到Netlify，请先设置访问令牌');
    }

    const { token } = connectionSettings;

    // 获取请求体中的 siteId
    const { siteId } = await request.json();

    const endpoint =
      action === 'publish'
        ? `https://api.netlify.com/api/v1/sites/${siteId}/deploys/${deployId}/restore`
        : `https://api.netlify.com/api/v1/deploys/${deployId}/${action}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`部署操作失败: ${response.status} ${errorText}`);
      return errorResponse(response.status, `部署${action}操作失败`);
    }

    const responseData = await response.json();

    logger.info(`用户 ${userId} 成功对部署 ${deployId} 执行了 ${action} 操作`);
    return successResponse(responseData, `部署${action}操作成功`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`部署${params.action}操作失败: ${errorMessage}`);
    return errorResponse(500, `部署${params.action}操作失败`);
  }
}
