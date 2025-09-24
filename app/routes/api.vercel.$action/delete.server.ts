import { getVercelConnectionSettings } from '~/lib/.server/connectionSettings';
import { deleteDeploymentById, getDeploymentById } from '~/lib/.server/deployment';
import { request } from '~/lib/fetch';
import { errorResponse, successResponse } from '~/utils/api-response';
import { createScopedLogger } from '~/utils/logger';
import type { VercelResponseError } from './type';

const logger = createScopedLogger('api.vercel.delete');

export type DeletePageArgs = {
  userId: string;
  request: Request;
};
/**
 * 删除 Vercel 中指定的部署
 *
 * @param token Vercel API 令牌
 * @param deploymentId 部署 ID
 * @returns 是否成功
 */
async function removeVercelDeployment(token: string, deploymentId: string): Promise<boolean> {
  try {
    const response = await request(`https://api.vercel.com/v13/deployments/${deploymentId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = (await response.json()) as VercelResponseError;
      logger.error(`删除 Vercel 部署 ${deploymentId} 失败: ${errorData.error?.message}`);
      throw new Error(`${errorData.error?.message}`);
    }

    return true;
  } catch (error) {
    logger.error(`删除 Vercel 部署 ${deploymentId} 时发生错误:`, error);
    throw new Error(`${error}`);
  }
}

export async function deletePage({ userId, request }: DeletePageArgs) {
  const { id } = await request.json();

  try {
    const deployment = await getDeploymentById(id);
    if (!deployment) {
      return errorResponse(404, '未找到部署记录');
    }

    const connectionSettings = await getVercelConnectionSettings(userId);
    if (!connectionSettings) {
      return errorResponse(401, '未连接到 Vercel，请重新连接至 Vercel');
    }

    const deploymentId = deployment.deploymentId;

    if (!deploymentId) {
      return errorResponse(400, '部署记录缺少必要信息');
    }

    const { token } = connectionSettings;

    await removeVercelDeployment(token, deploymentId);
    await deleteDeploymentById(id);

    logger.info(`用户 ${userId} 已删除 Vercel 部署 ${id}`);

    return successResponse(id, '页面已删除');
  } catch (error) {
    logger.error(`删除 Vercel 部署 ${id} 失败:`, error);
    return errorResponse(500, error instanceof Error ? error.message : '删除失败');
  }
}
