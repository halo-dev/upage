import type { ActionFunctionArgs, LoaderFunctionArgs } from 'react-router';
import { requireAuth } from '~/.server/service/auth';
import { getVercelConnectionSettings, saveVercelConnectionSettings } from '~/.server/service/connection-settings';
import { createOrUpdateDeployment, getLatestDeployment } from '~/.server/service/deployment';
import { convertFilesToStringRecord, generateDeploymentFiles } from '~/.server/service/files-generator';
import { errorResponse, successResponse } from '~/.server/utils/api-response';
import { createScopedLogger } from '~/.server/utils/logger';
import { DeploymentPlatformEnum, DeploymentStatusEnum } from '~/types/deployment';
import type { VercelProjectInfo } from '~/types/vercel';
import { isBinaryString } from '~/utils/file-utils';

const logger = createScopedLogger('api.vercel.deploy');

export type GetVercelDeployByProjectIdArgs = {
  request: Request;
  userId: string;
};

export async function loader({ request }: LoaderFunctionArgs) {
  const authResult = await requireAuth(request, { isApi: true });
  if (authResult instanceof Response) {
    return authResult;
  }
  const userId = authResult.userInfo?.sub;
  if (!userId) {
    return errorResponse(401, '用户未登录');
  }

  return getVercelDeployByProjectId({ request, userId });
}

async function getVercelDeployByProjectId({ request, userId }: { request: Request; userId: string }) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get('projectId');
  const requestToken = url.searchParams.get('token');

  // 从用户设置中获取连接信息
  let connectionSettings = await getVercelConnectionSettings(userId);

  // 如果请求参数中提供了token，优先使用请求参数中的信息，并更新用户设置
  if (requestToken) {
    connectionSettings = {
      token: requestToken,
    };

    // 更新用户设置
    await saveVercelConnectionSettings(userId, requestToken);
  }

  // 如果没有连接信息，返回错误
  if (!connectionSettings) {
    return errorResponse(401, '未连接到Vercel，请先设置访问令牌');
  }

  const { token } = connectionSettings;

  if (!projectId) {
    return errorResponse(400, '缺少项目ID');
  }

  try {
    // Get project info
    const projectResponse = await fetch(`https://api.vercel.com/v9/projects/${projectId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!projectResponse.ok) {
      return errorResponse(400, '无法获取项目');
    }

    const projectData = (await projectResponse.json()) as any;

    // Get latest deployment
    const deploymentsResponse = await fetch(`https://api.vercel.com/v6/deployments?projectId=${projectId}&limit=1`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!deploymentsResponse.ok) {
      return errorResponse(400, '获取部署信息失败');
    }

    const deploymentsData = (await deploymentsResponse.json()) as any;

    const latestDeployment = deploymentsData.deployments?.[0];

    return successResponse(
      {
        project: {
          id: projectData.id,
          name: projectData.name,
          url: `https://${projectData.name}.vercel.app`,
        },
        deploy: latestDeployment
          ? {
              id: latestDeployment.id,
              state: latestDeployment.state,
              url: latestDeployment.url ? `https://${latestDeployment.url}` : `https://${projectData.name}.vercel.app`,
            }
          : null,
      },
      '获取部署信息成功',
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`获取 Vercel 部署失败: ${errorMessage}`);
    return errorResponse(500, '获取部署失败');
  }
}

interface DeployRequestBody {
  projectId?: string;
  messageId: string;
  chatId: string;
  token?: string;
  attach?: {
    uPageHtml?: string;
    [key: string]: unknown;
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const authResult = await requireAuth(request, { isApi: true });
  if (authResult instanceof Response) {
    return authResult;
  }
  const userId = authResult.userInfo?.sub;
  if (!userId) {
    return errorResponse(401, '用户未登录');
  }

  return handleVercelDeploy({ request, userId });
}

// Existing action function for POST requests
async function handleVercelDeploy({ request, userId }: { request: Request; userId: string }) {
  try {
    const { projectId, messageId, token: requestToken, chatId, attach } = (await request.json()) as DeployRequestBody;

    if (!messageId || !chatId) {
      return errorResponse(400, '缺少必要参数');
    }

    const generatedFiles = await generateDeploymentFiles({
      messageId,
      inner: false,
      attachBody: attach?.uPageHtml,
    });

    const files = convertFilesToStringRecord(generatedFiles);

    // 从用户设置中获取连接信息
    let connectionSettings = await getVercelConnectionSettings(userId);

    // 如果请求体中提供了token，优先使用请求体中的信息，并更新用户设置
    if (requestToken) {
      connectionSettings = {
        token: requestToken,
      };

      // 更新用户设置
      await saveVercelConnectionSettings(userId, requestToken);
    }

    // 如果没有连接信息，返回错误
    if (!connectionSettings) {
      return errorResponse(401, '未连接到Vercel，请先设置访问令牌');
    }

    const { token } = connectionSettings;

    const existingDeployment = await getLatestDeployment(userId, chatId, DeploymentPlatformEnum.VERCEL);
    let targetProjectId;
    if (projectId) {
      targetProjectId = projectId;
    } else if (existingDeployment?.deploymentId) {
      targetProjectId = existingDeployment.deploymentId;
    } else {
      targetProjectId = undefined;
    }

    let projectInfo: VercelProjectInfo | undefined;

    if (targetProjectId) {
      const projectResponse = await fetch(`https://api.vercel.com/v9/projects/${targetProjectId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (projectResponse.ok) {
        const existingProject = (await projectResponse.json()) as any;
        projectInfo = {
          id: existingProject.id,
          name: existingProject.name,
          url: `https://${existingProject.name}.vercel.app`,
          chatId,
        };
      }
    }

    if (!projectInfo) {
      const projectName = `upage-${chatId}-${Date.now()}`.toLocaleLowerCase();
      const createProjectResponse = await fetch('https://api.vercel.com/v9/projects', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: projectName,
          framework: null,
        }),
      });

      if (!createProjectResponse.ok) {
        const errorData = (await createProjectResponse.json()) as any;
        return errorResponse(400, `创建项目失败: ${errorData.error?.message || '未知错误'}`);
      }

      const newProject = (await createProjectResponse.json()) as any;
      targetProjectId = newProject.id;
      projectInfo = {
        id: newProject.id,
        name: newProject.name,
        url: `https://${newProject.name}.vercel.app`,
        chatId,
      };
    }

    // Prepare files for deployment
    const deploymentFiles = [];

    for (const [filePath, content] of Object.entries(files)) {
      // Ensure file path doesn't start with a slash for Vercel
      const normalizedPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
      deploymentFiles.push({
        file: normalizedPath,
        data: isBinaryString(content) ? Buffer.from(content, 'binary').toString('base64') : content,
        encoding: isBinaryString(content) ? 'base64' : 'utf-8',
      });
    }

    // Create a new deployment
    const deployResponse = await fetch(`https://api.vercel.com/v13/deployments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: projectInfo.name,
        project: targetProjectId,
        target: 'production',
        files: deploymentFiles,
        routes: [{ src: '/(.*)', dest: '/$1' }],
      }),
    });

    if (!deployResponse.ok) {
      const errorData = (await deployResponse.json()) as any;
      return errorResponse(400, `创建部署失败: ${errorData.error?.message || '未知错误'}`);
    }

    const deployData = (await deployResponse.json()) as any;

    // Poll for deployment status
    let retryCount = 0;
    const maxRetries = 60;
    let deploymentUrl = '';
    let deploymentState = '';

    while (retryCount < maxRetries) {
      const statusResponse = await fetch(`https://api.vercel.com/v13/deployments/${deployData.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (statusResponse.ok) {
        const status = (await statusResponse.json()) as any;
        deploymentState = status.readyState;
        const alias = status.alias;
        const automaticAliases = status.automaticAliases;

        if (status.readyState === 'READY' || status.readyState === 'ERROR') {
          if (status.aliasAssigned) {
            const diffAlias = alias.filter((item: string) => !automaticAliases.includes(item));
            deploymentUrl = `https://${diffAlias[0]}`;
          } else {
            deploymentUrl = status.url ? `https://${status.url}` : '';
          }
          break;
        }
      }

      retryCount++;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    if (deploymentState === 'ERROR') {
      return errorResponse(500, '部署失败');
    }

    if (retryCount >= maxRetries) {
      return errorResponse(500, '部署超时');
    }

    const finalUrl = deploymentUrl || projectInfo.url;

    // 记录部署信息
    try {
      await createOrUpdateDeployment({
        userId,
        chatId,
        platform: DeploymentPlatformEnum.VERCEL,
        deploymentId: deployData.id,
        url: finalUrl,
        status: deploymentState === 'READY' ? DeploymentStatusEnum.SUCCESS : DeploymentStatusEnum.PENDING,
        metadata: {
          projectId: projectInfo.id,
          projectName: projectInfo.name,
        },
      });
      logger.info(`为用户 ${userId} 创建了 Vercel 部署记录`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logger.error(`创建部署记录失败: ${errorMessage}`);
      // 不影响主流程，继续返回成功
    }

    return successResponse(
      {
        deploy: {
          id: deployData.id,
          state: deploymentState,
          url: finalUrl,
        },
        project: projectInfo,
      },
      '部署成功',
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`Vercel 部署失败: ${errorMessage}`);
    return errorResponse(500, '部署失败');
  }
}
