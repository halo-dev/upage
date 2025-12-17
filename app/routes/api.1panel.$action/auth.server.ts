import { type ActionFunctionArgs } from 'react-router';
import { delete1PanelConnectionSettings, save1PanelConnectionSettings } from '~/.server/service/connection-settings';
import { errorResponse, successResponse } from '~/.server/utils/api-response';
import { createScopedLogger } from '~/.server/utils/logger';
import { getWebsiteList } from '~/routes/api.1panel.$action/1panel.server';

const logger = createScopedLogger('api.1panel.auth');

export type HandleAuthArgs = ActionFunctionArgs & {
  userId: string;
};

export async function handleAuth({ request, userId }: HandleAuthArgs) {
  try {
    const { serverUrl, apiKey } = await request.json();

    if (!serverUrl) {
      return errorResponse(400, '缺少服务器地址参数');
    }

    if (!apiKey) {
      return errorResponse(400, '缺少API密钥参数');
    }

    const parsedServerUrl = serverUrl.replace(/\/$/, '');
    const websitesResponse = await getWebsiteList(parsedServerUrl, apiKey);

    if (websitesResponse.code !== 200) {
      await delete1PanelConnectionSettings(userId);
      return errorResponse(websitesResponse.code, websitesResponse.message || '连接1Panel失败');
    }

    await save1PanelConnectionSettings(userId, parsedServerUrl, apiKey);
    logger.info(`用户 ${userId} 成功验证并保存了 1Panel 连接信息`);

    const websites = websitesResponse.data || [];
    websites.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return successResponse(
      {
        websites,
        totalWebsites: websites.length,
        lastUpdated: new Date().toISOString(),
      },
      '1Panel 连接验证成功',
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`验证 1Panel 连接失败: ${errorMessage}`);
    return errorResponse(500, '验证 1Panel 连接失败');
  }
}
