import { prisma } from '~/.server/service/prisma';
import { storageProvider } from '~/.server/storage/index.server';
import { errorResponse, successResponse } from '~/.server/utils/api-response';
import { getAssetDirPath, getAssetStoragePath, getAssetUrl } from '~/.server/utils/asset-utils';
import { createScopedLogger } from '~/.server/utils/logger';

const logger = createScopedLogger('api.upload.asset');

const MAX_UPLOAD_SIZE_MB = process.env.MAX_UPLOAD_SIZE_MB ? parseInt(process.env.MAX_UPLOAD_SIZE_MB) : 5;

/**
 * 从 URL 中提取存储路径
 * 例如: /uploads/assets/userId/messageId/file.png -> assets/userId/messageId/file.png
 */
function extractStoragePathFromUrl(url: string): string | null {
  try {
    const urlPattern = /^\/uploads\/(.+)$/;
    const match = url.match(urlPattern);
    return match ? match[1] : null;
  } catch (error) {
    logger.error('解析 URL 失败', { url, error });
    return null;
  }
}

/**
 * 删除旧资源文件
 * @param oldUrl 旧文件的 URL
 * @param pageId 页面 ID
 * @param userId 用户 ID（用于验证权限）
 */
async function deleteOldAsset(oldUrl: string, pageId: string, userId: string): Promise<void> {
  try {
    const storagePath = extractStoragePathFromUrl(oldUrl);
    if (!storagePath) {
      logger.warn('无效的旧文件 URL，跳过删除', { oldUrl });
      return;
    }

    const oldAsset = await prisma.pageAsset.findFirst({
      where: {
        storagePath,
        pageId,
      },
    });

    if (!oldAsset) {
      logger.debug('未找到旧资源记录，可能已被删除', { storagePath, pageId });
      return;
    }

    const fileDeleted = await storageProvider.deleteFile(storagePath);
    if (fileDeleted) {
      logger.debug('旧文件删除成功', { storagePath });
    } else {
      logger.warn('旧文件删除失败或文件不存在', { storagePath });
    }

    await prisma.pageAsset.delete({
      where: { id: oldAsset.id },
    });

    logger.info('旧资源清理成功', {
      assetId: oldAsset.id,
      storagePath,
      pageId,
    });
  } catch (error) {
    logger.error('删除旧资源失败，继续上传新文件', { oldUrl, error });
  }
}

type UploadAssetParams = {
  request: Request;
  userId: string;
};

/**
 * 处理资源文件上传请求，并创建 PageAsset 记录
 *
 * 参数：
 * - file: 要上传的文件
 * - messageId: 消息 ID（必需）
 * - pageId: 页面 ID（必需）
 *
 * 返回：
 * - url: 文件访问URL
 * - filename: 文件名
 * - contentType: 文件类型
 * - size: 文件大小（字节）
 * - assetId: PageAsset 记录 ID
 */
export const uploadAsset = async ({ request, userId }: UploadAssetParams) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const messageId = formData.get('messageId') as string;
    const pageId = formData.get('pageId') as string;
    const oldUrl = formData.get('oldUrl') as string | null;

    if (!file || !(file instanceof File)) {
      return errorResponse(400, '未找到有效的文件');
    }

    if (!messageId) {
      return errorResponse(400, '缺少 messageId 参数');
    }

    if (!pageId) {
      return errorResponse(400, '缺少 pageId 参数');
    }

    const maxFileSize = MAX_UPLOAD_SIZE_MB * 1024 * 1024;

    if (file.size > maxFileSize) {
      return errorResponse(413, `文件大小超过限制，最大允许${MAX_UPLOAD_SIZE_MB}MB`);
    }

    if (oldUrl) {
      await deleteOldAsset(oldUrl, pageId, userId);
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const assetDirPath = getAssetDirPath(userId, messageId);

    const uploadResult = await storageProvider.uploadFile({
      dirs: assetDirPath,
      contentType: file.type || 'application/octet-stream',
      filename: file.name,
      data: fileBuffer,
      keepOriginalFilename: true,
    });

    const storagePath = getAssetStoragePath(userId, messageId, uploadResult.filename);
    const url = getAssetUrl(storagePath);

    const pageAsset = await prisma.pageAsset.create({
      data: {
        pageId,
        filename: uploadResult.filename,
        storagePath,
        url,
        fileType: uploadResult.contentType,
        fileSize: uploadResult.size,
        sort: 0,
      },
    });

    logger.info('资源上传并创建 PageAsset 记录成功', {
      assetId: pageAsset.id,
      messageId,
      pageId,
      filename: uploadResult.filename,
    });

    return successResponse(
      {
        url,
        filename: uploadResult.filename,
        contentType: uploadResult.contentType,
        size: uploadResult.size,
        assetId: pageAsset.id,
      },
      '文件上传成功',
    );
  } catch (error) {
    logger.error('资源文件上传失败:', error);
    return errorResponse(500, '文件上传失败');
  }
};
