import { Octokit, type RestEndpointMethodTypes } from '@octokit/rest';
import { getGitHubConnectionSettings } from '~/.server/service/connection-settings';
import { createOrUpdateDeployment } from '~/.server/service/deployment';
import { errorResponse, successResponse } from '~/.server/utils/api-response';
import { createScopedLogger } from '~/.server/utils/logger';
import { DeploymentPlatformEnum, DeploymentStatusEnum } from '~/types/deployment';
import { formatFile } from '~/utils/prettier';
import type { GitHubPushRequest, GitHubPushResponse } from './type';

const logger = createScopedLogger('api.github.push');

export type HandleGitHubPushArgs = {
  request: Request;
  userId: string;
};

/**
 * 处理 GitHub 代码推送
 */
export async function handleGitHubPush({ request, userId }: HandleGitHubPushArgs) {
  try {
    const { repoName, commitMessage, files, isPrivate, chatId } = (await request.json()) as GitHubPushRequest;

    if (!repoName || !files || !chatId) {
      return errorResponse(400, '缺少必需参数: repoName, files, chatId');
    }

    if (Object.keys(files).length === 0) {
      return errorResponse(400, '没有文件需要推送');
    }

    const connectionSettings = await getGitHubConnectionSettings(userId);

    if (!connectionSettings) {
      return errorResponse(401, '未连接到 GitHub，请先进行认证');
    }

    const { token } = connectionSettings;

    const octokit = new Octokit({
      auth: token,
    });

    const { data: currentUser } = await octokit.users.getAuthenticated();
    const owner = currentUser.login;

    logger.info(`用户 ${userId} 开始推送代码到仓库 ${owner}/${repoName}`);

    let repo: RestEndpointMethodTypes['repos']['get']['response']['data'];
    let isNewRepo = false;

    try {
      const { data } = await octokit.repos.get({ owner, repo: repoName });
      repo = data;
      logger.info(`仓库 ${owner}/${repoName} 已存在`);
    } catch (error: any) {
      if (error.status === 404) {
        logger.info(`仓库 ${owner}/${repoName} 不存在，正在创建...`);
        isNewRepo = true;

        const { data } = await octokit.repos.createForAuthenticatedUser({
          name: repoName,
          private: isPrivate || false,
          auto_init: true,
        });
        repo = data;
        logger.info(`仓库 ${owner}/${repoName} 创建成功`);

        await new Promise((resolve) => setTimeout(resolve, 2000));
      } else {
        throw error;
      }
    }

    const defaultBranch = repo.default_branch || 'main';
    logger.info(`使用分支: ${defaultBranch}`);

    const { data: ref } = await octokit.git.getRef({
      owner: repo.owner.login,
      repo: repo.name,
      ref: `heads/${defaultBranch}`,
    });
    const latestCommitSha = ref.object.sha;
    logger.info(`最新 commit SHA: ${latestCommitSha}`);

    logger.info(`开始创建 blobs，共 ${Object.keys(files).length} 个文件`);
    const blobs = await Promise.all(
      Object.entries(files).map(async ([path, content]) => {
        if (path && content) {
          try {
            const formatContent = await formatFile(path, content);

            const { data: blob } = await octokit.git.createBlob({
              owner: repo.owner.login,
              repo: repo.name,
              content: Buffer.from(formatContent).toString('base64'),
              encoding: 'base64',
            });

            logger.debug(`创建 blob 成功: ${path} -> ${blob.sha}`);
            return { path, sha: blob.sha };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '未知错误';
            logger.error(`创建 blob 失败: ${path} ${errorMessage}`);
            throw error;
          }
        }
        return null;
      }),
    );

    const validBlobs = blobs.filter((blob) => blob !== null);

    if (validBlobs.length === 0) {
      return errorResponse(400, '没有有效的文件可以推送');
    }

    logger.info(`成功创建 ${validBlobs.length} 个 blobs`);

    const { data: newTree } = await octokit.git.createTree({
      owner: repo.owner.login,
      repo: repo.name,
      base_tree: latestCommitSha,
      tree: validBlobs.map((blob) => ({
        path: blob!.path,
        mode: '100644',
        type: 'blob',
        sha: blob!.sha,
      })),
    });

    logger.info(`创建 tree 成功: ${newTree.sha}`);

    const finalCommitMessage = commitMessage || `Update from UPage at ${new Date().toISOString()}`;
    const { data: newCommit } = await octokit.git.createCommit({
      owner: repo.owner.login,
      repo: repo.name,
      message: finalCommitMessage,
      tree: newTree.sha,
      parents: [latestCommitSha],
    });

    logger.info(`创建 commit 成功: ${newCommit.sha}`);

    await octokit.git.updateRef({
      owner: repo.owner.login,
      repo: repo.name,
      ref: `heads/${defaultBranch}`,
      sha: newCommit.sha,
    });

    logger.info(`更新分支引用成功: ${defaultBranch} -> ${newCommit.sha}`);

    const repoUrl = repo.html_url;

    try {
      await createOrUpdateDeployment({
        userId,
        chatId,
        platform: DeploymentPlatformEnum.GITHUB,
        deploymentId: repo.id.toString(),
        url: repoUrl,
        status: DeploymentStatusEnum.SUCCESS,
        metadata: {
          repoName: repo.name,
          fullName: repo.full_name,
          commitSha: newCommit.sha,
          branch: defaultBranch,
          isNewRepo,
          private: repo.private,
        },
      });
      logger.info(`为用户 ${userId} 创建了 GitHub 部署记录`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logger.error(`创建部署记录失败: ${errorMessage}`);
    }

    const response: GitHubPushResponse = {
      repo: {
        id: repo.id,
        name: repo.name,
        full_name: repo.full_name,
        html_url: repoUrl,
      },
      commit: {
        sha: newCommit.sha,
        url: newCommit.html_url,
      },
    };

    return successResponse(response, '代码推送成功');
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`GitHub 推送失败: ${errorMessage}`);

    if (error.status === 401) {
      return errorResponse(401, 'GitHub 令牌已过期或无效，请重新认证');
    }

    if (error.status === 403) {
      return errorResponse(403, 'GitHub API 请求频率超限或权限不足');
    }

    if (error.status === 422) {
      return errorResponse(422, `无法创建仓库或推送代码: ${errorMessage}`);
    }

    return errorResponse(500, `推送失败: ${errorMessage}`);
  }
}
