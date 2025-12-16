import { type ActionFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/.server/service/auth';
import { getNetlifyConnectionSettings } from '~/.server/service/connection-settings';
import { deleteDeploymentsByPlatformAndId } from '~/.server/service/deployment';
import { errorResponse, successResponse } from '~/.server/utils/api-response';
import { createScopedLogger } from '~/.server/utils/logger';
import { DeploymentPlatformEnum } from '~/types/deployment';

const logger = createScopedLogger('api.netlify.sites');

export async function action({ request, params }: ActionFunctionArgs) {
  if (request.method !== 'DELETE') {
    return errorResponse(405, '方法不允许');
  }

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
    return errorResponse(400, '缺少站点 ID');
  }

  try {
    const connectionSettings = await getNetlifyConnectionSettings(userId);

    if (!connectionSettings) {
      return errorResponse(401, '未连接到 Netlify，请先设置访问令牌');
    }

    const { token } = connectionSettings;

    const response = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`删除站点失败: ${response.status} ${errorText}`);
      return errorResponse(response.status, '删除站点失败');
    }

    await deleteDeploymentsByPlatformAndId(DeploymentPlatformEnum.NETLIFY, siteId);
    logger.info(`用户 ${userId} 成功删除了站点 ${siteId}`);
    return successResponse({}, '站点删除成功');
  } catch (error) {
    logger.error('删除站点失败:', error);
    return errorResponse(500, '删除站点失败');
  }
}
