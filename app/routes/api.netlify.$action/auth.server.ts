import { deleteNetlifyConnectionSettings, saveNetlifyConnectionSettings } from '~/lib/.server/connectionSettings';
import { errorResponse, successResponse } from '~/utils/api-response';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.netlify.auth');

export type HandleAuthArgs = {
  request: Request;
  userId: string;
};

export async function handleNetlifyAuth({ request, userId }: HandleAuthArgs) {
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
    logger.error('验证 Netlify 令牌失败:', error);
    return errorResponse(500, '验证 Netlify 令牌失败');
  }
}
