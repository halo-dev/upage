import { prisma } from '~/.server/service/prisma';
import { errorResponse, successResponse } from '~/.server/utils/api-response';
import { createScopedLogger } from '~/.server/utils/logger';

const logger = createScopedLogger('api.deployments.stats');

export type GetDeploymentStatsArgs = {
  userId: string;
};

export async function getDeploymentStats({ userId }: GetDeploymentStatsArgs) {
  try {
    const totalSites = await prisma.deployment.count({
      where: { userId },
    });

    const platformStats = await prisma.deployment.groupBy({
      by: ['platform'],
      _count: {
        id: true,
      },
      where: { userId },
    });

    const sitesByPlatform = platformStats.reduce(
      (acc, stat) => {
        acc[stat.platform] = stat._count.id;
        return acc;
      },
      {} as Record<string, number>,
    );

    return successResponse(
      {
        totalSites,
        sitesByPlatform,
        totalDays: 30,
      },
      '获取部署统计数据成功',
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`获取部署统计数据失败: ${errorMessage}`);
    return errorResponse(500, `获取部署统计数据失败: ${errorMessage}`);
  }
}
