import type { ActionFunctionArgs } from 'react-router';
import { requireAuth } from '~/.server/service/auth';
import {
  deleteVercelConnectionSettings,
  getVercelConnectionSettings,
  saveVercelConnectionSettings,
} from '~/.server/service/connection-settings';
import { errorResponse, successResponse } from '~/.server/utils/api-response';
import { createScopedLogger } from '~/.server/utils/logger';

const logger = createScopedLogger('api.vercel.auth');

export async function action({ request }: ActionFunctionArgs) {
  const authResult = await requireAuth(request, { isApi: true });
  if (authResult instanceof Response) {
    return authResult;
  }
  const userId = authResult.userInfo?.sub;
  if (!userId) {
    return errorResponse(401, '用户未登录');
  }

  return handleVercelAuth({ request, userId });
}

async function handleVercelAuth({ request, userId }: { request: Request; userId: string }) {
  try {
    const { token } = await request.json();
    // 从数据库中获取 token
    const connectionSettings = await getVercelConnectionSettings(userId);
    if (!token && !connectionSettings?.token) {
      return errorResponse(400, '缺少令牌参数');
    }

    const vercelToken = token || connectionSettings?.token;
    const response = await fetch('https://api.vercel.com/v2/user', {
      headers: {
        Authorization: `Bearer ${vercelToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      await deleteVercelConnectionSettings(userId);
      return errorResponse(401, '无效的令牌或未经授权');
    }

    const userData = await response.json();

    await saveVercelConnectionSettings(userId, vercelToken);
    logger.info(`用户 ${userId} 成功验证并保存了 Vercel 令牌`);

    return successResponse(
      {
        user: userData.user || userData,
        isConnect: !!userData,
      },
      'Vercel 令牌验证成功',
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`验证 Vercel 令牌失败: ${errorMessage}`);
    return errorResponse(500, '验证 Vercel 令牌失败');
  }
}
