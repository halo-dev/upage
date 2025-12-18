import type { LoaderFunctionArgs } from 'react-router';
import { requireAuth } from '~/.server/service/auth';
import { prisma } from '~/.server/service/prisma';
import { errorResponse, successResponse } from '~/.server/utils/api-response';
import { createScopedLogger } from '~/.server/utils/logger';

const logger = createScopedLogger('api.deployments.stats');

export async function loader({ request }: LoaderFunctionArgs) {
  const authResult = await requireAuth(request, { isApi: true });
  if (authResult instanceof Response) {
    return authResult;
  }

  const userId = authResult.userInfo?.sub;
  if (!userId) {
    return errorResponse(401, '用户未登录');
  }

  return getDeploymentStats(userId);
}

async function getDeploymentStats(userId: string) {
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
