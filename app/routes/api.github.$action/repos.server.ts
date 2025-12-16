import { Octokit } from '@octokit/rest';
import { getGitHubConnectionSettings } from '~/.server/service/connection-settings';
import { errorResponse, successResponse } from '~/.server/utils/api-response';
import { createScopedLogger } from '~/.server/utils/logger';
import type { GitHubRepoItem } from './type';

const logger = createScopedLogger('api.github.repos');

export type GetGitHubReposArgs = {
  request: Request;
  userId: string;
};

/**
 * 获取用户的 GitHub 仓库列表
 */
export async function getGitHubRepos({ request, userId }: GetGitHubReposArgs) {
  try {
    const connectionSettings = await getGitHubConnectionSettings(userId);

    if (!connectionSettings) {
      return errorResponse(401, '未连接到 GitHub，请先进行认证');
    }

    const { token } = connectionSettings;

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '5', 10);
    const sort = url.searchParams.get('sort') || 'updated';

    const octokit = new Octokit({
      auth: token,
    });

    const { data: repos } = await octokit.repos.listForAuthenticatedUser({
      sort: sort as 'created' | 'updated' | 'pushed' | 'full_name',
      per_page: limit,
      affiliation: 'owner',
    });

    const repoItems = repos.map((repo) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      html_url: repo.html_url,
      description: repo.description,
      private: repo.private,
      stargazers_count: repo.stargazers_count,
      forks_count: repo.forks_count,
      default_branch: repo.default_branch,
      updated_at: repo.updated_at,
      language: repo.language,
    })) as GitHubRepoItem[];

    return successResponse(
      {
        repos: repoItems,
        total: repos.length,
      },
      '获取仓库列表成功',
    );
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`获取 GitHub 仓库列表失败: ${errorMessage}`);

    if (error.status === 401) {
      return errorResponse(401, 'GitHub 令牌已过期或无效，请重新认证');
    }

    return errorResponse(500, `获取仓库列表失败: ${errorMessage}`);
  }
}
