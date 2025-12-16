import { getDeploymentByChatAndPlatform } from '~/.server/service/deployment';
import { errorResponse, successResponse } from '~/.server/utils/api-response';
import { type DeploymentPlatform, DeploymentPlatformEnum } from '~/types/deployment';

interface GetDeploymentByChatParams {
  chatId: string;
  platform?: DeploymentPlatform;
}

/**
 * 根据 chatId 和平台类型获取部署信息
 */
export async function getDeploymentByChat(params: GetDeploymentByChatParams) {
  const { chatId, platform = DeploymentPlatformEnum._1PANEL } = params;

  if (!chatId) {
    return errorResponse(400, '缺少 chatId 参数');
  }

  try {
    const deployment = await getDeploymentByChatAndPlatform(chatId, platform);

    if (!deployment) {
      return errorResponse(404, `未找到 chatId ${chatId} 在平台 ${platform} 的部署记录`);
    }

    return successResponse({
      deployment,
    });
  } catch (error) {
    console.error('[API] 获取部署信息失败:', error);
    return errorResponse(500, '获取部署信息失败');
  }
}
