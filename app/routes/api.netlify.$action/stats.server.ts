import { getNetlifyConnectionSettings } from '~/.server/service/connection-settings';
import { errorResponse, successResponse } from '~/.server/utils/api-response';
import { createScopedLogger } from '~/.server/utils/logger';

const logger = createScopedLogger('api.netlify.stats');

export type GetNetlifyStatsArgs = {
  userId: string;
};

export async function getNetlifyStats({ userId }: GetNetlifyStatsArgs) {
  try {
    const connectionSettings = await getNetlifyConnectionSettings(userId);

    if (!connectionSettings) {
      return errorResponse(401, '未连接到Netlify，请先设置访问令牌');
    }

    const { token } = connectionSettings;

    const sitesResponse = await fetch('https://api.netlify.com/api/v1/sites', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!sitesResponse.ok) {
      return errorResponse(sitesResponse.status, '获取站点列表失败');
    }

    const sitesData = await sitesResponse.json();

    let deploysData = [];
    let buildsData = [];
    let lastDeployTime = '';

    if (sitesData && sitesData.length > 0) {
      const firstSite = sitesData[0];

      const deploysResponse = await fetch(`https://api.netlify.com/api/v1/sites/${firstSite.id}/deploys`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (deploysResponse.ok) {
        deploysData = await deploysResponse.json();

        if (deploysData.length > 0) {
          lastDeployTime = deploysData[0].created_at;

          const buildsResponse = await fetch(`https://api.netlify.com/api/v1/sites/${firstSite.id}/builds`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (buildsResponse.ok) {
            buildsData = await buildsResponse.json();
          }
        }
      }
    }

    return successResponse(
      {
        sites: sitesData,
        deploys: deploysData,
        builds: buildsData,
        lastDeployTime,
        totalSites: sitesData.length,
      },
      '获取 Netlify 站点统计信息成功',
    );
  } catch (error) {
    logger.error('获取 Netlify 站点统计信息失败:', error);
    return errorResponse(500, '获取 Netlify 站点统计信息失败');
  }
}
