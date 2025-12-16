import { createScopedLogger } from '~/.server/utils/logger';
import { prisma } from './prisma';

const logger = createScopedLogger('page-asset');

/**
 * Get all assets by page ID
 * @param pageId page ID
 * @returns PageAsset records array
 */
export async function getAssetsByPageId(pageId: string) {
  try {
    const assets = await prisma.pageAsset.findMany({
      where: { pageId },
      orderBy: { sort: 'asc' },
    });

    return assets;
  } catch (error) {
    logger.error(`[PageAsset] 获取页面 ${pageId} 的资源失败:`, error);
    throw error;
  }
}

/**
 * PageAsset create parameters interface
 */
export interface PageAssetCreateParams {
  pageId: string;
  filename: string;
  storagePath: string;
  url: string;
  fileType: string;
  fileSize: number;
  sort?: number;
}

/**
 * Batch create PageAsset records
 * @param assets assets array
 * @returns created PageAsset records array
 */
export async function createPageAssets(assets: PageAssetCreateParams[]) {
  try {
    const createdAssets = await prisma.$transaction(
      assets.map((asset) =>
        prisma.pageAsset.create({
          data: {
            pageId: asset.pageId,
            filename: asset.filename,
            storagePath: asset.storagePath,
            url: asset.url,
            fileType: asset.fileType,
            fileSize: asset.fileSize,
            sort: asset.sort ?? 0,
          },
        }),
      ),
    );

    logger.info(`[PageAsset] 批量创建了 ${createdAssets.length} 个资源记录`);
    return createdAssets;
  } catch (error) {
    logger.error('[PageAsset] 批量创建 PageAsset 失败:', error);
    throw error;
  }
}

/**
 * Create single PageAsset record
 * @param asset asset parameters
 * @returns created PageAsset record
 */
export async function createPageAsset(asset: PageAssetCreateParams) {
  try {
    const createdAsset = await prisma.pageAsset.create({
      data: {
        pageId: asset.pageId,
        filename: asset.filename,
        storagePath: asset.storagePath,
        url: asset.url,
        fileType: asset.fileType,
        fileSize: asset.fileSize,
        sort: asset.sort ?? 0,
      },
    });

    logger.info(`[PageAsset] 创建了资源记录: ${createdAsset.id}`);
    return createdAsset;
  } catch (error) {
    logger.error('[PageAsset] 创建 PageAsset 失败:', error);
    throw error;
  }
}
