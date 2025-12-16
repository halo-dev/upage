import type { ActionFunctionArgs } from '@remix-run/node';
import { get1PanelConnectionSettings } from '~/.server/service/connection-settings';
import { getDeploymentById, updateDeploymentStatus } from '~/.server/service/deployment';
import { errorResponse, successResponse } from '~/.server/utils/api-response';
import { createScopedLogger } from '~/.server/utils/logger';
import { toggleAccessWebsite } from './1panel.server';

const logger = createScopedLogger('api.1panel.toggle-access');

export type ToggleAccessArgs = ActionFunctionArgs & {
  userId: string;
};

export async function toggleAccess({ request, userId }: ToggleAccessArgs) {
  const { id } = await request.json();

  try {
    const deployment = await getDeploymentById(id);

    if (!deployment) {
      return errorResponse(404, '未找到部署记录');
    }

    const connectionSettings = await get1PanelConnectionSettings(userId);
    if (!connectionSettings) {
      return errorResponse(401, '未配置1Panel连接信息');
    }

    const currentStatus = deployment.status;
    const newStatus = currentStatus !== 'inactive' ? 'inactive' : 'success';

    const { deploymentId: siteId } = deployment;
    const { serverUrl, apiKey } = connectionSettings;
    const operate = newStatus === 'success' ? 'start' : 'stop';
    const result = await toggleAccessWebsite({ serverUrl, apiKey, siteId: Number(siteId), operate });
    if (!result) {
      return errorResponse(500, '切换访问状态失败');
    }

    await updateDeploymentStatus(id, newStatus);

    logger.info(`用户 ${userId} 已${newStatus === 'success' ? '开启' : '停止'} 1Panel 网站 ${siteId} 的访问`);

    return successResponse(
      {
        status: newStatus,
      },
      `已${newStatus === 'success' ? '开启' : '停止'}访问`,
    );
  } catch (error) {
    logger.error(`切换1Panel部署 ${id} 访问状态失败:`, error);
    return errorResponse(500, error instanceof Error ? error.message : '操作失败');
  }
}
