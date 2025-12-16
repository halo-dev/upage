import { getVercelConnectionSettings } from '~/.server/service/connection-settings';
import { errorResponse, successResponse } from '~/.server/utils/api-response';
import { createScopedLogger } from '~/.server/utils/logger';

const logger = createScopedLogger('api.vercel.stats');

export type GetVercelStatsArgs = {
  userId: string;
};

export async function getVercelStats({ userId }: GetVercelStatsArgs) {
  try {
    const connectionSettings = await getVercelConnectionSettings(userId);

    if (!connectionSettings) {
      return errorResponse(401, '未连接到Vercel，请先设置访问令牌');
    }

    const { token } = connectionSettings;

    const projectsResponse = await fetch('https://api.vercel.com/v9/projects', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!projectsResponse.ok) {
      return errorResponse(projectsResponse.status, '获取项目列表失败');
    }

    const projectsData = await projectsResponse.json();
    const projects = projectsData.projects || [];

    const projectsWithDeployments = await Promise.all(
      projects.map(async (project: any) => {
        try {
          const deploymentsResponse = await fetch(
            `https://api.vercel.com/v6/deployments?projectId=${project.id}&limit=1`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            },
          );

          if (deploymentsResponse.ok) {
            const deploymentsData = await deploymentsResponse.json();
            return {
              ...project,
              latestDeployments: deploymentsData.deployments || [],
            };
          }

          return project;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '未知错误';
          logger.error(`获取项目 ${project.id} 的部署信息失败: ${errorMessage}`);
          return project;
        }
      }),
    );

    return successResponse(
      {
        projects: projectsWithDeployments,
        totalProjects: projectsWithDeployments.length,
      },
      '获取 Vercel 项目统计信息成功',
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`获取 Vercel 项目统计信息失败: ${errorMessage}`);
    return errorResponse(500, '获取 Vercel 项目统计信息失败');
  }
}
