import { prisma } from '~/.server/service/prisma';
import { createScopedLogger } from '~/.server/utils/logger';
import type { DeploymentPlatform } from '~/types/deployment';

const logger = createScopedLogger('deployment.server');

/**
 * 部署记录创建参数接口
 */
export interface DeploymentCreateParams {
  userId: string;
  chatId: string;
  platform: DeploymentPlatform;
  deploymentId: string;
  url: string;
  status: string;
  metadata?: Record<string, any>;
}

/**
 * 创建或更新部署记录
 * 当 userId、chatId 和 platform 都匹配时，更新现有记录而不是创建新记录
 *
 * @param params 部署记录创建参数
 * @returns 创建或更新的部署记录
 */
export async function createOrUpdateDeployment(params: DeploymentCreateParams) {
  const { userId, chatId, platform, deploymentId, url, status, metadata } = params;

  try {
    const existingDeployment = await prisma.deployment.findFirst({
      where: {
        userId,
        chatId,
        platform,
      },
    });

    let deployment;

    if (existingDeployment) {
      deployment = await prisma.deployment.update({
        where: { id: existingDeployment.id },
        data: {
          deploymentId,
          url,
          status,
          metadata,
        },
      });
      logger.info(`[Deployment] 更新了用户 ${userId} 的部署记录: ${deployment.id}, 平台: ${platform}`);
    } else {
      deployment = await prisma.deployment.create({
        data: {
          userId,
          chatId,
          platform,
          deploymentId,
          url,
          status,
          metadata,
        },
      });
      logger.info(`[Deployment] 创建了用户 ${userId} 的部署记录: ${deployment.id}, 平台: ${platform}`);
    }

    return deployment;
  } catch (error) {
    logger.error('[Deployment] 创建或更新部署记录失败:', error);
    throw error;
  }
}

/**
 * 根据ID获取部署记录
 * @param id 部署记录ID
 * @returns 部署记录
 */
export async function getDeploymentById(id: string) {
  try {
    const deployment = await prisma.deployment.findUnique({
      where: { id },
    });

    return deployment;
  } catch (error) {
    logger.error(`[Deployment] 获取部署记录 ${id} 失败:`, error);
    throw error;
  }
}

/**
 * 根据ID删除部署记录
 * @param id 部署记录ID
 * @returns 删除的部署记录
 */
export async function deleteDeploymentById(id: string) {
  try {
    const deployment = await prisma.deployment.delete({
      where: { id },
    });
    return deployment;
  } catch (error) {
    logger.error(`[Deployment] 删除部署记录 ${id} 失败:`, error);
    throw error;
  }
}

/**
 * 获取用户的所有部署记录
 * @param userId 用户ID
 * @param limit 限制返回记录数量
 * @param offset 偏移量
 * @returns 部署记录列表
 */
export async function getUserDeployments(userId: string, limit = 20, offset = 0) {
  try {
    const deployments = await prisma.deployment.findMany({
      where: { userId },
      orderBy: {
        createdAt: 'desc',
      },
      skip: offset,
      take: limit,
    });

    const total = await prisma.deployment.count({
      where: { userId },
    });

    return {
      deployments,
      total,
    };
  } catch (error) {
    logger.error(`[Deployment] 获取用户 ${userId} 的部署记录列表失败:`, error);
    throw error;
  }
}

/**
 * 获取特定聊天的所有部署记录
 * @param chatId 聊天ID
 * @returns 部署记录列表
 */
export async function getChatDeployments(chatId: string) {
  try {
    const deployments = await prisma.deployment.findMany({
      where: { chatId },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return deployments;
  } catch (error) {
    logger.error(`[Deployment] 获取聊天 ${chatId} 的部署记录列表失败:`, error);
    throw error;
  }
}

/**
 * 获取用户在特定平台的所有部署记录
 * @param userId 用户ID
 * @param platform 平台名称
 * @returns 部署记录列表
 */
export async function getUserPlatformDeployments(userId: string, platform: DeploymentPlatform) {
  try {
    const deployments = await prisma.deployment.findMany({
      where: {
        userId,
        platform,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return deployments;
  } catch (error) {
    logger.error(`[Deployment] 获取用户 ${userId} 在平台 ${platform} 的部署记录列表失败:`, error);
    throw error;
  }
}

/**
 * 获取用户在特定平台和聊天的最新部署记录
 * @param userId 用户ID
 * @param chatId 聊天ID
 * @param platform 平台名称
 * @returns 最新的部署记录，如果不存在则返回 null
 */
export async function getLatestDeployment(userId: string, chatId: string, platform: DeploymentPlatform) {
  try {
    const deployment = await prisma.deployment.findFirst({
      where: {
        userId,
        chatId,
        platform,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return deployment;
  } catch (error) {
    logger.error(`[Deployment] 获取用户 ${userId} 在平台 ${platform} 的最新部署记录失败:`, error);
    return null;
  }
}

/**
 * 根据 chatId 和平台获取部署记录
 * @param chatId 聊天ID
 * @param platform 平台名称
 * @returns 最新的部署记录，如果不存在则返回 null
 */
export async function getDeploymentByChatAndPlatform(chatId: string, platform: DeploymentPlatform) {
  try {
    const deployment = await prisma.deployment.findFirst({
      where: {
        chatId,
        platform,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return deployment;
  } catch (error) {
    logger.error(`[Deployment] 获取聊天 ${chatId} 在平台 ${platform} 的部署记录失败:`, error);
    return null;
  }
}

/**
 * 更新部署记录状态
 * @param id 部署记录ID
 * @param status 新状态
 * @param metadata 可选的元数据更新
 * @returns 更新后的部署记录
 */
export async function updateDeploymentStatus(id: string, status: string, metadata?: Record<string, any>) {
  try {
    const updatedDeployment = await prisma.deployment.update({
      where: { id },
      data: {
        status,
        ...(metadata ? { metadata } : {}),
      },
    });

    logger.info(`[Deployment] 更新了部署记录 ${id} 的状态为 ${status}`);
    return updatedDeployment;
  } catch (error) {
    logger.error(`[Deployment] 更新部署记录 ${id} 状态失败:`, error);
    throw error;
  }
}

/**
 * 根据平台和平台特定的ID删除所有相关的部署记录
 *
 * @param platform 平台名称
 * @param platformId 平台特定的ID
 * @returns 删除的记录数量
 */
export async function deleteDeploymentsByPlatformAndId(platform: DeploymentPlatform, platformId: string | number) {
  try {
    // 将 platformId 转换为字符串，因为在数据库中 deploymentId 是字符串类型
    const deploymentId = String(platformId);

    const result = await prisma.deployment.deleteMany({
      where: {
        platform,
        deploymentId,
      },
    });

    logger.info(`[Deployment] 删除了平台 ${platform} 上 ID 为 ${platformId} 的 ${result.count} 条部署记录`);
    return result.count;
  } catch (error) {
    logger.error(`[Deployment] 删除平台 ${platform} 上 ID 为 ${platformId} 的部署记录失败:`, error);
    throw error;
  }
}

/**
 * 分页获取用户在特定平台的部署记录
 * @param userId 用户ID
 * @param platform 平台名称（可选）
 * @param limit 每页记录数
 * @param offset 偏移量
 * @returns 部署记录列表和总数
 */
export async function getUserPlatformDeploymentsWithPagination(
  userId: string,
  platform?: DeploymentPlatform,
  limit = 10,
  offset = 0,
) {
  try {
    const where = {
      userId,
      ...(platform ? { platform } : {}),
    };

    const deployments = await prisma.deployment.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      skip: offset,
      take: limit,
      include: {
        chat: {
          select: {
            id: true,
            description: true,
          },
        },
      },
    });

    const total = await prisma.deployment.count({ where });

    return {
      deployments,
      total,
    };
  } catch (error) {
    logger.error(
      `[Deployment] 分页获取用户 ${userId} ${platform ? `在平台 ${platform} ` : ''}的部署记录列表失败:`,
      error,
    );
    throw error;
  }
}
