import { type ActionFunctionArgs } from '@remix-run/node';
import { get1PanelConnectionSettings, save1PanelConnectionSettings } from '~/.server/service/connection-settings';
import { deleteDeploymentsByPlatformAndId } from '~/.server/service/deployment';
import { errorResponse, successResponse } from '~/.server/utils/api-response';
import { createScopedLogger } from '~/.server/utils/logger';
import { deleteWebsite, getWebsiteList } from '~/routes/api.1panel.$action/1panel.server';
import { DeploymentPlatformEnum } from '~/types/deployment';

interface WebsiteListRequestBody {
  serverUrl?: string;
  apiKey?: string;
}

interface DeleteWebsiteRequestBody {
  serverUrl?: string;
  apiKey?: string;
  siteId: number;
}

export type HandleWebsitesArgs = ActionFunctionArgs & {
  userId: string;
};

const logger = createScopedLogger('api.1panel.websites');

export async function handleWebsites({ request, userId }: HandleWebsitesArgs) {
  try {
    if (request.method === 'POST') {
      const requestBody = (await request.json()) as WebsiteListRequestBody;

      let connectionSettings = await get1PanelConnectionSettings(userId);

      if (requestBody.serverUrl && requestBody.apiKey) {
        connectionSettings = {
          serverUrl: requestBody.serverUrl,
          apiKey: requestBody.apiKey,
        };

        await save1PanelConnectionSettings(userId, requestBody.serverUrl, requestBody.apiKey);
      }

      if (!connectionSettings) {
        return errorResponse(401, '未配置1Panel连接信息，请先设置服务器地址和API密钥');
      }

      const { serverUrl, apiKey } = connectionSettings;

      const websites = await getWebsiteList(serverUrl, apiKey);

      if (websites.code !== 200) {
        logger.warn('获取网站列表失败', JSON.stringify(websites));
        return errorResponse(websites.code, websites.message);
      }

      return successResponse(websites.data ?? [], '获取网站列表成功');
    }
    if (request.method === 'DELETE') {
      const requestBody = (await request.json()) as DeleteWebsiteRequestBody;

      if (!requestBody.siteId) {
        return errorResponse(400, '未提供网站ID');
      }

      const connectionSettings = await get1PanelConnectionSettings(userId);

      if (!connectionSettings) {
        return errorResponse(401, '未配置1Panel连接信息，请先设置服务器地址和API密钥');
      }

      const { serverUrl, apiKey } = connectionSettings;

      await deleteWebsite({
        serverUrl,
        apiKey,
        siteId: requestBody.siteId,
      });

      await deleteDeploymentsByPlatformAndId(DeploymentPlatformEnum._1PANEL, requestBody.siteId);

      return successResponse(true, '网站删除成功');
    }
    logger.warn('不支持的 HTTP 方法', JSON.stringify({ url: request.url, method: request.method }));
    return errorResponse(405, '不支持的 HTTP 方法');
  } catch (error) {
    logger.error('处理 1Panel 网站请求错误:', error);
    return errorResponse(500, '处理请求失败 - ' + (error instanceof Error ? error.message : String(error)));
  }
}
