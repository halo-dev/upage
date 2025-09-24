import { getNetlifyConnectionSettings } from '~/lib/.server/connectionSettings';
import { deleteDeploymentById, getDeploymentById } from '~/lib/.server/deployment';
import { errorResponse, successResponse } from '~/utils/api-response';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.netlify.delete');

export type DeletePageArgs = {
  userId: string;
  request: Request;
};

export async function deleteNetlifySite(token: string, siteId: string): Promise<void> {
  try {
    const response = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = (await response.json()) as { message: string };
      logger.error(`删除站点失败: ${response.status} ${errorData.message}`);
      throw new Error(`${errorData.message}`);
    }
  } catch (error) {
    logger.error(`删除站点失败:`, error);
    throw new Error(`${error}`);
  }
}

export async function deletePage({ userId, request }: DeletePageArgs) {
  const { id } = await request.json();

  try {
    // 查找部署记录
    const deployment = await getDeploymentById(id);

    if (!deployment) {
      return errorResponse(404, '未找到部署记录');
    }

    // 获取Netlify连接设置
    const connectionSettings = await getNetlifyConnectionSettings(userId);
    if (!connectionSettings) {
      return errorResponse(401, '未连接到Netlify');
    }

    const siteId = (deployment.metadata as Record<string, any>)?.siteId;
    if (!siteId) {
      return errorResponse(400, '部署记录缺少必要信息');
    }

    // 删除站点
    await deleteNetlifySite(connectionSettings.token, siteId);

    // 删除部署记录
    await deleteDeploymentById(id);

    logger.info(`用户 ${userId} 已删除 Netlify 部署 ${id}`);

    return successResponse(id, '页面已删除');
  } catch (error) {
    logger.error(`删除 Netlify 部署 ${id} 失败:`, error);
    return errorResponse(500, error instanceof Error ? error.message : '删除失败');
  }
}
