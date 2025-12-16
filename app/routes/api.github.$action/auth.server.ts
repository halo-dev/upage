import { Octokit } from '@octokit/rest';
import {
  deleteGitHubConnectionSettings,
  getGitHubConnectionSettings,
  saveGitHubConnectionSettings,
} from '~/.server/service/connection-settings';
import { errorResponse, successResponse } from '~/.server/utils/api-response';
import { createScopedLogger } from '~/.server/utils/logger';
import type { GitHubAuthRequest, GitHubAuthResponse } from './type';

const logger = createScopedLogger('api.github.auth');

export type HandleGitHubAuthArgs = {
  request: Request;
  userId: string;
};

/**
 * 处理 GitHub 认证
 */
export async function handleGitHubAuth({ request, userId }: HandleGitHubAuthArgs) {
  try {
    const { token, tokenType } = (await request.json()) as GitHubAuthRequest;

    const connectionSettings = await getGitHubConnectionSettings(userId);

    if (!token && !connectionSettings?.token) {
      return errorResponse(400, '缺少令牌参数');
    }

    const githubToken = token || connectionSettings?.token;
    const githubTokenType = tokenType || connectionSettings?.tokenType || 'classic';

    if (!githubToken) {
      return errorResponse(400, '缺少 GitHub 令牌');
    }

    const octokit = new Octokit({
      auth: githubToken,
    });

    try {
      const { data: userData } = await octokit.users.getAuthenticated();

      await saveGitHubConnectionSettings(userId, githubToken, githubTokenType);
      logger.info(`用户 ${userId} 成功验证并保存了 GitHub 令牌`);

      const response: GitHubAuthResponse = {
        user: userData,
        isConnect: true,
      };

      return successResponse(response, 'GitHub 令牌验证成功');
    } catch (error: any) {
      await deleteGitHubConnectionSettings(userId);

      if (error.status === 401) {
        return errorResponse(401, '无效的令牌或未经授权');
      }

      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logger.error(`验证 GitHub 令牌失败: ${errorMessage}`);
      return errorResponse(500, `验证失败: ${errorMessage}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`处理 GitHub 认证请求失败: ${errorMessage}`);
    return errorResponse(500, '验证 GitHub 令牌失败');
  }
}

export async function handleGitHubDisconnect({ userId }: { userId: string }) {
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
