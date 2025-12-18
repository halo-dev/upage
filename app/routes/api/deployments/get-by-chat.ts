import type { LoaderFunctionArgs } from 'react-router';
import { requireAuth } from '~/.server/service/auth';
import { getDeploymentByChatAndPlatform } from '~/.server/service/deployment';
import { errorResponse, successResponse } from '~/.server/utils/api-response';
import { type DeploymentPlatform, DeploymentPlatformEnum } from '~/types/deployment';

export async function loader({ request }: LoaderFunctionArgs) {
  const authResult = await requireAuth(request, { isApi: true });

  if (authResult instanceof Response) {
    return authResult;
  }

  const userId = authResult.userInfo?.sub;
  if (!userId) {
    return errorResponse(401, '用户未登录');
  }

  const url = new URL(request.url);
  const chatId = url.searchParams.get('chatId');
  const platform = url.searchParams.get('platform') as any;

  return getDeploymentByChat({ chatId: chatId || '', platform });
}

/**
 * 根据 chatId 和平台类型获取部署信息
 */
async function getDeploymentByChat({
  chatId,
  platform = DeploymentPlatformEnum._1PANEL,
}: {
  chatId: string;
  platform?: DeploymentPlatform;
}) {
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
