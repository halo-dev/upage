import { type LoaderFunctionArgs } from '@remix-run/node';
import { get1PanelConnectionSettings } from '~/.server/service/connection-settings';
import { errorResponse, successResponse } from '~/.server/utils/api-response';
import { createScopedLogger } from '~/.server/utils/logger';
import { getWebsiteList } from '~/routes/api.1panel.$action/1panel.server';

const logger = createScopedLogger('api.1panel.stats');

export type GetStatsArgs = LoaderFunctionArgs & {
  userId: string;
};

export async function getStats({ userId }: GetStatsArgs) {
  try {
    // 从用户设置中获取连接信息
    const connectionSettings = await get1PanelConnectionSettings(userId);

    if (!connectionSettings) {
      return errorResponse(401, '未连接到1Panel，请先设置服务器地址和API密钥');
    }

    const { serverUrl, apiKey } = connectionSettings;

    // 获取网站列表
    const websitesResponse = await getWebsiteList(serverUrl, apiKey);

    if (websitesResponse.code !== 200) {
      return errorResponse(websitesResponse.code, websitesResponse.message || '获取网站列表失败');
    }

    const websites = websitesResponse.data || [];
    websites.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return successResponse(
      {
        websites,
        totalWebsites: websites.length,
        lastUpdated: new Date().toISOString(),
      },
      '获取 1Panel 网站统计信息成功',
    );
  } catch (error) {
    logger.error('获取 1Panel 网站统计信息失败:', error);
    return errorResponse(500, '获取 1Panel 网站统计信息失败');
  }
}
