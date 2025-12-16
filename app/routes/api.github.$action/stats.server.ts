import { Octokit } from '@octokit/rest';
import { getGitHubConnectionSettings } from '~/.server/service/connection-settings';
import { errorResponse, successResponse } from '~/.server/utils/api-response';
import { createScopedLogger } from '~/.server/utils/logger';
import type { GitHubLanguageStats, GitHubRepoInfo, GitHubStats } from '~/types/github';

const logger = createScopedLogger('api.github.stats');

export type GetGitHubStatsArgs = {
  userId: string;
};

export async function getUserData(octokit: Octokit) {
  const { data: userData } = await octokit.users.getAuthenticated();
  return userData;
}

export async function getReposData(octokit: Octokit) {
  let allRepos: any[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 10) {
    const { data: repos } = await octokit.repos.listForAuthenticatedUser({
      per_page: 100,
      page,
    });

    allRepos = [...allRepos, ...repos];

    if (repos.length < 100) {
      hasMore = false;
    } else {
      page++;
    }
  }
  return allRepos;
}

export async function getOrganizationsData(octokit: Octokit) {
  let allOrganizations: any[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 10) {
    const { data: organizations } = await octokit.orgs.listForAuthenticatedUser({
      per_page: 100,
      page,
    });

    allOrganizations = [...allOrganizations, ...organizations];

    if (organizations.length < 100) {
      hasMore = false;
    } else {
      page++;
    }
  }

  return allOrganizations;
}
/**
 * 获取用户的 GitHub 统计信息
 */
export async function getGitHubStats({ userId }: GetGitHubStatsArgs) {
  try {
    const connectionSettings = await getGitHubConnectionSettings(userId);

    if (!connectionSettings) {
      return errorResponse(401, '未连接到 GitHub，请先进行认证');
    }

    const { token } = connectionSettings;

    const octokit = new Octokit({
      auth: token,
    });

    const allRepos = await getReposData(octokit);

    const totalStars = allRepos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
    const totalForks = allRepos.reduce((sum, repo) => sum + repo.forks_count, 0);
    const privateRepos = allRepos.filter((repo) => repo.private).length;

    const topRepos = [...allRepos]
      .sort((a, b) => b.stargazers_count - a.stargazers_count)
      .slice(0, 10)
      .map((repo) => ({
        name: repo.name,
        full_name: repo.full_name,
        html_url: repo.html_url,
        description: repo.description,
        stargazers_count: repo.stargazers_count,
        forks_count: repo.forks_count,
        default_branch: repo.default_branch,
        updated_at: repo.updated_at,
        languages_url: repo.languages_url,
      })) as GitHubRepoInfo[];

    const languages: GitHubLanguageStats = {};
    allRepos.forEach((repo) => {
      if (repo.language) {
        languages[repo.language] = (languages[repo.language] || 0) + 1;
      }
    });

    const userData = await getUserData(octokit);
    const organizations = await getOrganizationsData(octokit);

    const stats: GitHubStats = {
      repos: topRepos,
      languages,
      publicGists: userData.public_gists,
      publicRepos: userData.public_repos,
      privateRepos,
      totalStars,
      totalForks,
      followers: userData.followers,
      organizations,
      totalGists: 0,
      privateGists: 0,
      lastUpdated: new Date().toISOString(),
    };

    return successResponse(
      {
        user: userData,
        stats,
      },
      '获取 GitHub 统计信息成功',
    );
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`获取 GitHub 统计信息失败: ${errorMessage}`);

    if (error.status === 401) {
      return errorResponse(401, 'GitHub 令牌已过期或无效，请重新认证');
    }

    if (error.status === 403) {
      return errorResponse(403, 'GitHub API 请求频率超限');
    }

    return errorResponse(500, `获取统计信息失败: ${errorMessage}`);
  }
}
