import type { ActionFunctionArgs } from 'react-router';
import { requireAuth } from '~/.server/service/auth';
import { getNetlifyConnectionSettings } from '~/.server/service/connection-settings';
import { getDeploymentById, updateDeploymentStatus } from '~/.server/service/deployment';
import { errorResponse, successResponse } from '~/.server/utils/api-response';
import { request } from '~/.server/utils/fetch';
import { createScopedLogger } from '~/.server/utils/logger';
import type { NetlifySite } from '~/types/netlify';
import { generateUUID } from '~/utils/uuid';

const logger = createScopedLogger('api.netlify.toggle-access');

export async function action({ request }: ActionFunctionArgs) {
  const authResult = await requireAuth(request, { isApi: true });
  if (authResult instanceof Response) {
    return authResult;
  }

  const userId = authResult.userInfo?.sub;
  if (!userId) {
    return errorResponse(401, '用户未登录');
  }

  return toggleAccess({ request, userId });
}

export async function setNetlifySiteName(token: string, siteId: string, name: string): Promise<NetlifySite> {
  try {
    const response = await request(`https://api.netlify.com/api/v1/sites/${siteId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      const errorData = (await response.json()) as {
        message: string;
      };
      throw new Error(errorData.message);
    }

    const result = (await response.json()) as NetlifySite;
    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`设置 Netlify 站点 ${siteId} 名称失败: ${errorMessage}`);
    throw new Error(`${errorMessage}`);
  }
}

export async function toggleAccess({ userId, request }: { userId: string; request: Request }) {
  const { id } = await request.json();

  try {
    const deployment = await getDeploymentById(id);

    if (!deployment) {
      return errorResponse(404, '未找到部署记录');
    }

    // 获取Netlify连接设置
    const connectionSettings = await getNetlifyConnectionSettings(userId);
    if (!connectionSettings) {
      return errorResponse(401, '未连接到Netlify');
    }

    const metadata = deployment.metadata as Record<string, any> | null;
    const siteId = metadata?.siteId;
    if (!siteId) {
      return errorResponse(400, '部署记录缺少必要信息');
    }

    let siteName = metadata?.siteName;
    // 获取当前状态
    const currentStatus = deployment.status;
    const newStatus = currentStatus === 'inactive' ? 'success' : 'inactive';
    if (newStatus === 'inactive') {
      // 为站点设置一个其他的别名，格式为 upage-inactive-${uuid}
      siteName = `upage-inactive-${generateUUID()}`;
    } else {
      if (!siteName) {
        const url = new URL(deployment.url);
        siteName = url.hostname.split('.')[0];
      }
    }
    // 设置 name 为当前的 siteName
    await setNetlifySiteName(connectionSettings.token, siteId, siteName);
    // 更新状态
    await updateDeploymentStatus(id, newStatus);

    logger.info(`用户 ${userId} 已${newStatus === 'success' ? '开启' : '停止'} Netlify 站点 ${siteId} 的访问`);

    return successResponse(id, `已${newStatus === 'success' ? '开启' : '停止'}访问`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`切换Netlify部署 ${id} 访问状态失败: ${errorMessage}`);
    return errorResponse(500, `操作失败: ${errorMessage}`);
  }
}
