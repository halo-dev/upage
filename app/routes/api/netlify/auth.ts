import type { ActionFunctionArgs } from 'react-router';
import { requireAuth } from '~/.server/service/auth';
import { deleteNetlifyConnectionSettings, saveNetlifyConnectionSettings } from '~/.server/service/connection-settings';
import { errorResponse, successResponse } from '~/.server/utils/api-response';
import { createScopedLogger } from '~/.server/utils/logger';

const logger = createScopedLogger('api.netlify.auth');

export async function action({ request }: ActionFunctionArgs) {
  const authResult = await requireAuth(request, { isApi: true });
  if (authResult instanceof Response) {
    return authResult;
  }

  const userId = authResult.userInfo?.sub;
  if (!userId) {
    return errorResponse(401, '用户未登录');
  }

  return handleNetlifyAuth({ request, userId });
}

async function handleNetlifyAuth({ request, userId }: { request: Request; userId: string }) {
  try {
    const { token } = await request.json();

    if (!token) {
      return errorResponse(400, '缺少令牌参数');
    }

    const response = await fetch('https://api.netlify.com/api/v1/user', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      await deleteNetlifyConnectionSettings(userId);
      return errorResponse(401, '无效的令牌或未经授权');
    }

    const userData = await response.json();

    await saveNetlifyConnectionSettings(userId, token);
    logger.info(`用户 ${userId} 成功验证并保存了 Netlify 令牌`);

    return successResponse(
      {
        isConnect: !!userData,
      },
      'Netlify 令牌验证成功',
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`验证 Netlify 令牌失败: ${errorMessage}`);
    return errorResponse(500, '验证 Netlify 令牌失败');
  }
}
