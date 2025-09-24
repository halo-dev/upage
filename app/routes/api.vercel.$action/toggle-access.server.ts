import { getVercelConnectionSettings } from '~/lib/.server/connectionSettings';
import { getDeploymentById, updateDeploymentStatus } from '~/lib/.server/deployment';
import { request } from '~/lib/fetch';
import { errorResponse, successResponse } from '~/utils/api-response';
import { createScopedLogger } from '~/utils/logger';
import type { VercelAlias, VercelResponseAliases, VercelResponseError } from './type';

const logger = createScopedLogger('api.vercel.manage');

/**
 * 获取 Vercel 项目的别名列表
 * @param token Vercel API 令牌
 * @param deploymentId Vercel 平台部署 ID
 * @returns 域名别名列表
 */
async function getVercelDomainAliases(token: string, deploymentId: string): Promise<VercelAlias[]> {
  try {
    const response = await request(`https://api.vercel.com/v2/deployments/${deploymentId}/aliases`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = (await response.json()) as VercelResponseError;
      logger.error(`获取 Vercel 项目 ${deploymentId} 的域名别名失败: ${errorData.error?.message}`);
      throw new Error(`${errorData.error?.message}`);
    }

    const data = (await response.json()) as VercelResponseAliases;
    return data.aliases;
  } catch (error) {
    logger.error(`获取 Vercel 项目 ${deploymentId} 的域名别名时发生错误:`, error);
    throw new Error(`${error}`);
  }
}

/**
 * 为 Vercel 项目添加域名别名
 * @param token Vercel API 令牌
 * @param deploymentId 项目 ID
 * @param domain 域名
 * @returns 是否成功
 */
async function setVercelDomainAlias(
  token: string,
  deploymentId: string,
  alias: string,
  redirect?: string,
): Promise<VercelAlias> {
  try {
    const response = await request(`https://api.vercel.com/v2/deployments/${deploymentId}/aliases`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        alias,
        redirect: redirect ?? null,
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json()) as VercelResponseError;
      logger.error(`为 Vercel 项目 ${deploymentId} 添加域名别名 ${alias} 失败:`, errorData);
      throw new Error(`${errorData.error?.message}`);
    }

    const data = (await response.json()) as VercelAlias;

    return data;
  } catch (error) {
    logger.error(`为 Vercel 项目 ${deploymentId} 添加域名别名 ${alias} 时发生错误:`, error);
    throw new Error(`${error}`);
  }
}

/**
 * 删除 Vercel 中指定的别名
 * @param token Vercel API 令牌
 * @param aliasId 别名 ID
 * @returns 是否成功
 */
async function removeVercelDomainAlias(token: string, aliasId: string): Promise<boolean> {
  try {
    const response = await request(`https://api.vercel.com/v2/aliases/${aliasId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = (await response.json()) as VercelResponseError;
      logger.error(`删除 Vercel 项目 ${aliasId} 的域名别名失败: ${errorData.error?.message}`);
      throw new Error(`${errorData.error?.message}`);
    }

    return true;
  } catch (error) {
    logger.error(`删除 Vercel 项目 ${aliasId} 的域名别名时发生错误:`, error);
    throw new Error(`${error}`);
  }
}

export type ToggleAccessArgs = {
  userId: string;
  request: Request;
};

export async function toggleAccess({ userId, request }: ToggleAccessArgs) {
  const { id } = await request.json();

  try {
    const deployment = await getDeploymentById(id);

    if (!deployment) {
      return errorResponse(404, '未找到部署记录');
    }

    const connectionSettings = await getVercelConnectionSettings(userId);
    if (!connectionSettings) {
      return errorResponse(401, '未连接到 Vercel，请重新连接至 Vercel');
    }

    const { token } = connectionSettings;
    const projectId = deployment.deploymentId;

    if (!projectId) {
      return errorResponse(400, '部署记录缺少必要信息');
    }

    // 获取当前状态
    const currentStatus = deployment.status;
    const newStatus = currentStatus === 'inactive' ? 'success' : 'inactive';

    // 获取当前域名别名
    const currentDomains = await getVercelDomainAliases(token, projectId);

    // 获取部署记录的元数据，确保它是一个对象
    const metadata: Record<string, any> =
      typeof deployment.metadata === 'object' && deployment.metadata !== null
        ? { ...(deployment.metadata as Record<string, any>) }
        : {};

    if (newStatus === 'inactive') {
      if (currentDomains.length > 0) {
        // 保存替换当前域名别名记录
        metadata.aliases = currentDomains;
        // 删除当前所有域名别名
        for (const alias of currentDomains) {
          await removeVercelDomainAlias(token, alias.uid!);
          logger.info(`已删除 Vercel 项目 ${projectId} 的域名别名: ${alias.alias}`);
        }
      }
    } else {
      if (currentDomains.length === 0) {
        const newAliases: VercelAlias[] = [];
        // 恢复已保存的所有域名别名
        const savedAliases = (metadata.aliases as VercelAlias[]) || [];
        if (savedAliases.length === 0) {
          // 如果保存的域名别名列表为空，则使用 deployment.url 的域名
          const urlObj = new URL(deployment.url);
          savedAliases.push({
            alias: urlObj.hostname,
            redirect: deployment.url,
            oldDeploymentId: deployment.id,
          });
        }
        for (const alias of savedAliases) {
          const newAlias = await setVercelDomainAlias(token, projectId, alias.alias, alias.redirect);
          newAliases.push(newAlias);
          logger.info(`已为 Vercel 项目 ${projectId} 添加域名别名: ${alias.alias}`);
        }
        metadata.aliases = newAliases;
      }
    }

    // 更新状态和元数据
    await updateDeploymentStatus(id, newStatus, metadata);

    logger.info(`用户 ${userId} 已${newStatus === 'success' ? '开启' : '停止'} Vercel 项目 ${projectId} 的访问`);

    return successResponse(id, `已${newStatus === 'success' ? '开启' : '停止'}访问`);
  } catch (error) {
    logger.error(`切换Vercel部署 ${id} 访问状态失败:`, error);
    return errorResponse(500, error instanceof Error ? error.message : '操作失败');
  }
}
