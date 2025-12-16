import type { ActionFunctionArgs } from '@remix-run/node';
import { get1PanelConnectionSettings } from '~/.server/service/connection-settings';
import { deleteDeploymentById, getDeploymentById } from '~/.server/service/deployment';
import { errorResponse, successResponse } from '~/.server/utils/api-response';
import { createScopedLogger } from '~/.server/utils/logger';
import { deleteWebsite } from './1panel.server';

const logger = createScopedLogger('api.1panel.delete');

export type DeletePageArgs = ActionFunctionArgs & {
  userId: string;
};

export async function deletePage({ request, userId }: DeletePageArgs) {
  const { id } = await request.json();

  try {
    // 查找部署记录
    const deployment = await getDeploymentById(id);

    if (!deployment) {
      return errorResponse(404, '未找到部署记录');
    }

    const connectionSettings = await get1PanelConnectionSettings(userId);
    if (!connectionSettings) {
      return errorResponse(401, '未配置1Panel连接信息');
    }

    const { deploymentId: siteId } = deployment;
    const { serverUrl, apiKey } = connectionSettings;

    const result = await deleteWebsite({ serverUrl, apiKey, siteId: Number(siteId) });
    if (!result) {
      return errorResponse(500, '删除1Panel网站失败');
    }

    await deleteDeploymentById(id);

    logger.info(`用户 ${userId} 已删除 1Panel 部署 ${id}`);
    return successResponse(true, '页面已删除');
  } catch (error) {
    logger.error(`删除 1Panel 部署 ${id} 失败:`, error);
    return errorResponse(500, error instanceof Error ? error.message : '删除失败');
  }
}
