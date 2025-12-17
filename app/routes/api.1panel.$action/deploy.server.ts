import { type ActionFunctionArgs } from 'react-router';
import { get1PanelConnectionSettings, save1PanelConnectionSettings } from '~/.server/service/connection-settings';
import { createOrUpdateDeployment, getLatestDeployment } from '~/.server/service/deployment';
import { convertFilesToStringRecord, generateDeploymentFiles } from '~/.server/service/files-generator';
import { errorResponse, successResponse } from '~/.server/utils/api-response';
import { createScopedLogger } from '~/.server/utils/logger';
import {
  createWebsite,
  getWebsite,
  getWebsiteByPrimaryDomain,
  type UploadFileContent,
  uploadFiles,
} from '~/routes/api.1panel.$action/1panel.server';
import type { _1PanelWebsite, _1PanelWebsiteInfo } from '~/types/1panel';
import { DeploymentPlatformEnum, DeploymentStatusEnum } from '~/types/deployment';

interface DeployRequestBody {
  websiteId: number;
  messageId: string;
  chatId: string;
  serverUrl?: string;
  apiKey?: string;
  websiteDomain?: string;
  protocol?: string;
  attach?: {
    uPageHtml?: string;
    [key: string]: unknown;
  };
}

export type HandleDeployArgs = ActionFunctionArgs & {
  userId: string;
};

const logger = createScopedLogger('api.1panel.deploy');

export async function handleDeploy({ request, userId }: HandleDeployArgs) {
  try {
    const {
      websiteId,
      messageId,
      chatId,
      serverUrl: requestServerUrl,
      apiKey: requestApiKey,
      websiteDomain,
      protocol,
      attach,
    } = (await request.json()) as DeployRequestBody;

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
    let connectionSettings = await get1PanelConnectionSettings(userId);

    // 如果请求体中提供了连接信息，优先使用请求体中的信息，并更新用户设置
    if (requestServerUrl && requestApiKey) {
      connectionSettings = {
        serverUrl: requestServerUrl,
        apiKey: requestApiKey,
      };

      // 更新用户设置
      await save1PanelConnectionSettings(userId, requestServerUrl, requestApiKey);
    }

    // 如果没有连接信息，返回错误
    if (!connectionSettings) {
      logger.warn('未配置1Panel连接信息');
      return errorResponse(401, '未配置1Panel连接信息，请先设置服务器地址和API密钥');
    }

    const { serverUrl, apiKey } = connectionSettings;

    const existingDeployment = await getLatestDeployment(userId, chatId, DeploymentPlatformEnum._1PANEL);
    let targetWebsiteId;
    if (websiteId) {
      targetWebsiteId = websiteId;
    } else if (existingDeployment?.deploymentId) {
      targetWebsiteId = parseInt(existingDeployment.deploymentId);
    } else {
      targetWebsiteId = undefined;
    }

    let websiteInfo: _1PanelWebsiteInfo | undefined;
    if (targetWebsiteId) {
      const websiteResponse = await getWebsite({
        serverUrl,
        apiKey,
        siteId: targetWebsiteId,
      });

      if (websiteResponse.data) {
        const existingWebsite = websiteResponse.data as _1PanelWebsite;
        websiteInfo = {
          id: existingWebsite.id,
          domain: existingWebsite.primaryDomain,
          url: `${existingWebsite.protocol.toLowerCase()}://${existingWebsite.primaryDomain}`,
          alias: existingWebsite.alias,
          sitePath: existingWebsite.sitePath,
          chatId,
        };
      }
    }

    if (!websiteInfo) {
      // If no websiteId provided, create a new website
      const alias = `upage-${chatId}-${Date.now()}`;
      const createWebsiteResponse = await createWebsite({
        serverUrl,
        apiKey,
        alias,
        primaryDomain: websiteDomain,
        proxyProtocol: `${protocol || 'http'}://`,
        isSSL: protocol === 'https',
      });

      if (createWebsiteResponse.code !== 200) {
        logger.warn('无法创建网站', JSON.stringify(createWebsiteResponse));
        return errorResponse(400, `无法创建网站: ${createWebsiteResponse.data?.message || 'Unknown error'}`);
      }

      const { domain } = createWebsiteResponse.data as { domain: string };

      const webSiteInfo = await getWebsiteByPrimaryDomain(serverUrl, apiKey, domain);
      if (webSiteInfo.code !== 200) {
        logger.warn('无法获取网站信息', JSON.stringify(webSiteInfo));
        return errorResponse(400, '无法获取网站信息');
      }
      if (webSiteInfo.data.items == null) {
        logger.warn('获取网站失败，请检查 1Panel 日志', JSON.stringify(webSiteInfo));
        return errorResponse(400, '获取网站失败，请检查 1Panel 日志');
      }

      const newWebsite = webSiteInfo.data.items.find((item) => item.alias === alias);
      if (!newWebsite) {
        logger.warn('无法获取网站信息', JSON.stringify(newWebsite));
        return errorResponse(400, '无法获取网站信息');
      }

      targetWebsiteId = newWebsite.id;
      websiteInfo = {
        id: newWebsite.id,
        domain: newWebsite.primaryDomain,
        sitePath: newWebsite.sitePath,
        alias: newWebsite.alias,
        url: `${newWebsite.protocol.toLowerCase()}://${newWebsite.primaryDomain}`,
        chatId,
      };
    }

    logger.info('创建网站成功 => ', websiteInfo.id, websiteInfo.domain, websiteInfo.url);

    if (!websiteInfo) {
      return errorResponse(400, '无法创建网站');
    }

    const deploymentFiles: UploadFileContent[] = [];
    for (const [filePath, content] of Object.entries(files)) {
      const lastSlashIndex = filePath.lastIndexOf('/');
      const folderPath = lastSlashIndex !== -1 ? filePath.substring(0, lastSlashIndex + 1) : '';
      const fileName = lastSlashIndex !== -1 ? filePath.substring(lastSlashIndex + 1) : filePath;
      // 获取 filename
      deploymentFiles.push({
        path: `${websiteInfo.sitePath}/index/${folderPath}`,
        fileName,
        data: content,
      });
    }

    try {
      await uploadFiles({
        serverUrl,
        apiKey,
        version: 'v2',
        files: deploymentFiles,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logger.warn(`上传文件失败: ${errorMessage}`);
      return errorResponse(400, `无法上传文件: ${errorMessage}`);
    }

    try {
      await createOrUpdateDeployment({
        userId,
        chatId,
        platform: DeploymentPlatformEnum._1PANEL,
        deploymentId: String(websiteInfo.id),
        url: websiteInfo.url,
        status: DeploymentStatusEnum.SUCCESS,
        metadata: {
          domain: websiteInfo.domain,
          alias: websiteInfo.alias,
          sitePath: websiteInfo.sitePath,
          serverUrl,
        },
      });
      logger.info(`为用户 ${userId} 创建了 1Panel 部署记录`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logger.error(`创建部署记录失败: ${errorMessage}`);
    }

    return successResponse(
      {
        deploy: {
          id: websiteInfo.id,
          domain: websiteInfo.domain,
          url: websiteInfo.url,
        },
      },
      '部署成功',
    );
  } catch (error) {
    console.error('1Panel deploy error:', error);
    return errorResponse(500, '部署到 1Panel 失败');
  }
}
