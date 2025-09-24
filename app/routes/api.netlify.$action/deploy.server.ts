import { getNetlifyConnectionSettings, saveNetlifyConnectionSettings } from '~/lib/.server/connectionSettings';
import { createOrUpdateDeployment, getLatestDeployment } from '~/lib/.server/deployment';
import { createScopedLogger } from '~/lib/.server/logger';
import { DeploymentPlatformEnum, DeploymentStatusEnum } from '~/types/deployment';
import type { NetlifySiteInfo } from '~/types/netlify';
import { errorResponse, successResponse } from '~/utils/api-response';
import { binaryStringToUint8Array, isBinaryString } from '~/utils/file-utils';

export type HandleDeployArgs = {
  request: Request;
  userId: string;
};

interface DeployRequestBody {
  siteId?: string;
  files: Record<string, string>;
  chatId: string;
  token?: string;
}

/**
 * 计算字符串或二进制数据的 SHA1 哈希值
 *
 * @param message 要计算哈希的字符串或二进制数据
 * @returns SHA1 哈希值
 */
async function sha1(message: string) {
  // 检查是否为二进制字符串
  let msgBuffer;
  if (isBinaryString(message)) {
    // 对于二进制字符串，使用 Buffer.from 处理
    const buffer = Buffer.from(message, 'binary');
    msgBuffer = new Uint8Array(buffer);
  } else {
    // 对于普通字符串，使用 TextEncoder
    msgBuffer = new TextEncoder().encode(message);
  }

  const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

const logger = createScopedLogger('api.netlify.deploy');

export async function handleDeploy({ request, userId }: HandleDeployArgs) {
  try {
    const { siteId, files, token: requestToken, chatId } = (await request.json()) as DeployRequestBody;

    let connectionSettings = await getNetlifyConnectionSettings(userId);

    if (requestToken) {
      connectionSettings = {
        token: requestToken,
      };

      await saveNetlifyConnectionSettings(userId, requestToken);
    }

    if (!connectionSettings) {
      logger.warn('未连接到Netlify');
      return errorResponse(401, '未连接到Netlify，请先设置访问令牌');
    }

    const { token } = connectionSettings;

    const existingDeployment = await getLatestDeployment(userId, chatId, DeploymentPlatformEnum.NETLIFY);
    let targetSiteId = siteId ? siteId : existingDeployment?.deploymentId ? existingDeployment.deploymentId : undefined;

    let siteInfo: NetlifySiteInfo | undefined;

    if (targetSiteId) {
      const siteResponse = await fetch(`https://api.netlify.com/api/v1/sites/${targetSiteId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (siteResponse.ok) {
        const existingSite = (await siteResponse.json()) as any;
        siteInfo = {
          id: existingSite.id,
          name: existingSite.name,
          url: existingSite.url,
          chatId,
        };
      }
    }

    if (!siteInfo) {
      const siteName = `upage-${chatId}-${Date.now()}`;
      const createSiteResponse = await fetch('https://api.netlify.com/api/v1/sites', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: siteName,
          custom_domain: null,
        }),
      });

      if (!createSiteResponse.ok) {
        return errorResponse(400, 'Failed to create site');
      }

      const newSite = (await createSiteResponse.json()) as any;
      targetSiteId = newSite.id;
      siteInfo = {
        id: newSite.id,
        name: newSite.name,
        url: newSite.url,
        chatId,
      };
    }

    // Create file digests
    const fileDigests: Record<string, string> = {};
    const filePathsAndHashes: Record<string, string> = {};

    for (const [filePath, content] of Object.entries(files)) {
      // Ensure file path starts with a forward slash
      const normalizedPath = filePath.startsWith('/') ? filePath : '/' + filePath;
      const hash = await sha1(content);
      fileDigests[normalizedPath] = hash;
      filePathsAndHashes[normalizedPath] = hash;
    }

    // Create a new deploy with digests
    const deployResponse = await fetch(`https://api.netlify.com/api/v1/sites/${targetSiteId}/deploys`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: fileDigests,
        async: true,
        skip_processing: false,
        draft: false,
        function_schedules: [],
        required: Object.keys(fileDigests),
        framework: null,
      }),
    });

    if (!deployResponse.ok) {
      const errorText = await deployResponse.text();
      logger.error(`创建部署失败: ${deployResponse.status} - ${errorText}`);
      return errorResponse(400, `Failed to create deployment: ${errorText}`);
    }

    const deploy = (await deployResponse.json()) as any;
    let retryCount = 0;
    const maxRetries = 60;
    let deploymentStatus;

    while (retryCount < maxRetries) {
      const statusResponse = await fetch(`https://api.netlify.com/api/v1/sites/${targetSiteId}/deploys/${deploy.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!statusResponse.ok) {
        if (statusResponse.status === 401) {
          return errorResponse(401, '链接已过期，请重新设置访问令牌。');
        }
        return errorResponse(400, '获取部署状态失败');
      }

      deploymentStatus = (await statusResponse.json()) as any;

      if (deploymentStatus.state === 'ready' || deploymentStatus.state === 'uploaded') {
        logger.info('部署完成，状态:', deploymentStatus.state);
        break;
      }

      if (deploymentStatus.state === 'prepared' || deploymentStatus.state === 'uploaded') {
        // Upload all files regardless of required array
        for (const [filePath, content] of Object.entries(files)) {
          const normalizedPath = filePath.startsWith('/') ? filePath : '/' + filePath;
          logger.info(`准备上传文件: ${normalizedPath}, 是否二进制: ${isBinaryString(content)}`);

          let uploadSuccess = false;
          let uploadRetries = 0;

          while (!uploadSuccess && uploadRetries < 3) {
            try {
              let uploadBody: string | Uint8Array | ArrayBuffer;
              if (isBinaryString(content)) {
                uploadBody = binaryStringToUint8Array(content);
              } else {
                uploadBody = content;
              }

              const uploadResponse = await fetch(
                `https://api.netlify.com/api/v1/deploys/${deploy.id}/files${normalizedPath}`,
                {
                  method: 'PUT',
                  headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/octet-stream',
                  },
                  body: uploadBody as BodyInit,
                },
              );

              uploadSuccess = uploadResponse.ok;

              if (!uploadSuccess) {
                if (uploadResponse.status === 422) {
                  logger.warn(
                    `Upload failed for ${normalizedPath} (${uploadResponse.status}, But it may be uploaded successfully`,
                  );
                  uploadSuccess = true;
                } else {
                  const errorText = await uploadResponse.text();
                  logger.error(`Upload failed for ${normalizedPath} (${uploadResponse.status}): ${errorText}`);
                  uploadRetries++;
                  await new Promise((resolve) => setTimeout(resolve, 2000));
                }
              } else {
                logger.info(`Successfully uploaded ${normalizedPath}`);
              }
            } catch (error) {
              logger.error('Upload error:', error);
              uploadRetries++;
              await new Promise((resolve) => setTimeout(resolve, 2000));
            }
          }

          if (!uploadSuccess) {
            return errorResponse(500, `上传文件失败： ${filePath}`);
          }
        }

        break;
      }

      if (deploymentStatus.state === 'error') {
        return errorResponse(500, deploymentStatus.error_message || 'Deploy preparation failed');
      }

      retryCount++;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (retryCount >= maxRetries) {
      return errorResponse(500, 'Deploy preparation timed out');
    }

    // 第二阶段：轮询直到部署完成
    logger.info('文件上传完成，等待部署完成...');
    retryCount = 0;
    const maxDeploymentRetries = 60; // 60秒超时

    while (retryCount < maxDeploymentRetries) {
      const statusResponse = await fetch(`https://api.netlify.com/api/v1/sites/${targetSiteId}/deploys/${deploy.id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      deploymentStatus = (await statusResponse.json()) as any;

      if (deploymentStatus.state === 'ready' || deploymentStatus.state === 'uploaded') {
        logger.info('部署完成，状态:', deploymentStatus.state);
        break;
      }

      if (deploymentStatus.state === 'error') {
        return errorResponse(500, deploymentStatus.error_message || 'Deployment failed');
      }

      retryCount++;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (retryCount >= maxDeploymentRetries) {
      return errorResponse(500, 'Deployment timed out');
    }

    try {
      await createOrUpdateDeployment({
        userId,
        chatId,
        platform: DeploymentPlatformEnum.NETLIFY,
        deploymentId: deploymentStatus.id,
        url: deploymentStatus.ssl_url || deploymentStatus.url,
        status: DeploymentStatusEnum.SUCCESS,
        metadata: {
          siteId: siteInfo.id,
          siteName: siteInfo.name,
        },
      });
      logger.info(`为用户 ${userId} 创建或更新了 Netlify 部署记录`);
    } catch (error) {
      logger.error('创建部署记录失败:', error);
    }

    return successResponse(
      {
        deploy: {
          id: deploymentStatus.id,
          state: deploymentStatus.state,
          url: deploymentStatus.ssl_url || deploymentStatus.url,
        },
        site: siteInfo,
      },
      '部署成功',
    );
  } catch (error) {
    logger.error('Deploy error:', error);
    return errorResponse(500, 'Deployment failed');
  }
}
