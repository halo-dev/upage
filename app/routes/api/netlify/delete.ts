import type { ActionFunctionArgs } from 'react-router';
import { requireAuth } from '~/.server/service/auth';
import { getNetlifyConnectionSettings } from '~/.server/service/connection-settings';
import { deleteDeploymentById, getDeploymentById } from '~/.server/service/deployment';
import { errorResponse, successResponse } from '~/.server/utils/api-response';
import { createScopedLogger } from '~/.server/utils/logger';

const logger = createScopedLogger('api.netlify.delete');

export async function action({ request }: ActionFunctionArgs) {
  const authResult = await requireAuth(request, { isApi: true });
  if (authResult instanceof Response) {
    return authResult;
  }

  const userId = authResult.userInfo?.sub;
  if (!userId) {
    return errorResponse(401, '用户未登录');
  }

  return deletePage({ request, userId });
}

async function deleteNetlifySite(token: string, siteId: string): Promise<void> {
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
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`删除站点失败: ${errorMessage}`);
    throw new Error(`${errorMessage}`);
  }
}

async function deletePage({ userId, request }: { userId: string; request: Request }) {
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
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`删除 Netlify 部署 ${id} 失败: ${errorMessage}`);
    return errorResponse(500, `删除失败: ${errorMessage}`);
  }
}
