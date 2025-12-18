import type { ActionFunctionArgs } from 'react-router';
import { requireAuth } from '~/.server/service/auth';
import { deleteGitHubConnectionSettings } from '~/.server/service/connection-settings';
import { errorResponse, successResponse } from '~/.server/utils/api-response';
import { createScopedLogger } from '~/.server/utils/logger';

const logger = createScopedLogger('api.github.disconnect');

export async function action(args: ActionFunctionArgs) {
  const { request } = args;

  // 验证用户身份
  const authResult = await requireAuth(request, { isApi: true });
  if (authResult instanceof Response) {
    return authResult;
  }

  const userId = authResult.userInfo?.sub;
  if (!userId) {
    return errorResponse(401, '用户未登录');
  }

  if (request.method !== 'DELETE') {
    return errorResponse(404, '未知的 API 操作');
  }

  try {
    await deleteGitHubConnectionSettings(userId);
    logger.info(`用户 ${userId} 已断开 GitHub 连接`);

    return successResponse({ success: true }, '已断开 GitHub 连接');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`断开 GitHub 连接失败: ${errorMessage}`);
    return errorResponse(500, '断开连接失败');
  }
}
