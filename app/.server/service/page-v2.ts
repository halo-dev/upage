import type { JsonValue } from '@prisma/client/runtime/library';
import { prisma } from '~/.server/service/prisma';
import { storageProvider } from '~/.server/storage/index.server';
import { getAssetDirPath, getAssetStoragePath, getAssetUrl } from '~/.server/utils/asset-utils';
import { createScopedLogger } from '~/.server/utils/logger';
import { extractDataUrlResources, replaceResourcePaths } from '~/.server/utils/resource-extractor';
import type { Page as PageV1 } from '~/types/actions';
import { getMimeType } from '~/utils/file-utils';
import { createPageAssets, type PageAssetCreateParams } from './page-asset';

const logger = createScopedLogger('page-v2');

/**
 * PageV2 create parameters interface
 */
export interface PageV2CreateParams {
  messageId: string;
  name: string;
  title: string;
  content: string;
  actionIds?: string[];
  headMeta?: JsonValue;
  headLinks?: JsonValue;
  headScripts?: JsonValue;
  headStyles?: JsonValue;
  headRaw?: string;
  sort?: number;
}

/**
 * PageV2 update parameters interface
 */
export interface PageV2UpdateParams {
  name?: string;
  title?: string;
  content?: string;
  actionIds?: string[];
  headMeta?: JsonValue;
  headLinks?: JsonValue;
  headScripts?: JsonValue;
  headStyles?: JsonValue;
  headRaw?: string;
  sort?: number;
}

/**
 * Get all PageV2 records by message ID
 * @param messageId message ID
 * @returns PageV2 records array
 */
export async function getPageV2ByMessageId(messageId: string) {
  try {
    const pages = await prisma.pageV2.findMany({
      where: { messageId },
      orderBy: { sort: 'asc' },
    });

    return pages;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`获取消息 ${messageId} 的 PageV2 失败: ${errorMessage}`);
    throw error;
  }
}

/**
 * Get single PageV2 record by message ID and page name
 * @param messageId message ID
 * @param name page name
 * @returns PageV2 record or null
 */
export async function getPageV2ByMessageIdAndName(messageId: string, name: string) {
  try {
    const page = await prisma.pageV2.findFirst({
      where: {
        messageId,
        name,
      },
    });

    return page;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`获取消息 ${messageId} 的 PageV2 页面 ${name} 失败: ${errorMessage}`);
    throw error;
  }
}

/**
 * Get PageV2 record by ID
 * @param id PageV2 ID
 * @returns PageV2 record or null
 */
export async function getPageV2ById(id: string) {
  try {
    const page = await prisma.pageV2.findUnique({
      where: { id },
    });

    return page;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`获取 PageV2 ${id} 失败: ${errorMessage}`);
    throw error;
  }
}

/**
 * Create new PageV2 record
 * @param params PageV2 create parameters
 * @returns created PageV2 record
 */
export async function createPageV2(params: PageV2CreateParams) {
  const { messageId, name, title, content, actionIds, headMeta, headLinks, headScripts, headStyles, headRaw, sort } =
    params;

  try {
    const page = await prisma.pageV2.create({
      data: {
        messageId,
        name,
        title,
        content,
        actionIds: actionIds || undefined,
        headMeta: headMeta || undefined,
        headLinks: headLinks || undefined,
        headScripts: headScripts || undefined,
        headStyles: headStyles || undefined,
        headRaw: headRaw || undefined,
        sort: sort ?? 0,
      },
    });

    logger.info(`为消息 ${messageId} 创建了页面: ${page.id} (${name})`);
    return page;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`为消息 ${messageId} 创建 PageV2 失败: ${errorMessage}`);
    throw error;
  }
}

/**
 * Create or update PageV2 record
 * @param params PageV2 create parameters
 * @returns created or updated PageV2 record
 */
export async function createOrUpdatePageV2(params: PageV2CreateParams) {
  const { messageId, name, title, content, actionIds, headMeta, headLinks, headScripts, headStyles, headRaw, sort } =
    params;

  try {
    const existingPage = await getPageV2ByMessageIdAndName(messageId, name);

    if (existingPage) {
      const updatedPage = await updatePageV2(existingPage.id, {
        title,
        content,
        actionIds,
        headMeta,
        headLinks,
        headScripts,
        headStyles,
        headRaw,
        sort,
      });
      logger.info(`更新了消息 ${messageId} 的页面: ${existingPage.id} (${name})`);
      return updatedPage;
    }

    const newPage = await createPageV2(params);
    return newPage;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`为消息 ${messageId} 创建或更新 PageV2 失败: ${errorMessage}`);
    throw error;
  }
}

/**
 * Batch create PageV2 records
 * @param pages pages array
 * @returns created PageV2 records array
 */
export async function createPagesV2(pages: PageV2CreateParams[]) {
  try {
    const createdPages = await prisma.$transaction(
      pages.map((page) =>
        prisma.pageV2.create({
          data: {
            messageId: page.messageId,
            name: page.name,
            title: page.title,
            content: page.content,
            actionIds: page.actionIds || [],
            headMeta: page.headMeta || undefined,
            headLinks: page.headLinks || undefined,
            headScripts: page.headScripts || undefined,
            headStyles: page.headStyles || undefined,
            headRaw: page.headRaw || undefined,
            sort: page.sort ?? 0,
          },
        }),
      ),
    );

    logger.info(`批量创建了 ${createdPages.length} 个页面`);
    return createdPages;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`批量创建 PageV2 失败: ${errorMessage}`);
    throw error;
  }
}

/**
 * Batch create or update PageV2 records
 * @param pages pages array
 * @returns created or updated PageV2 records array
 */
export async function createOrUpdatePagesV2(pages: PageV2CreateParams[]) {
  try {
    const results = [];

    for (const page of pages) {
      const result = await createOrUpdatePageV2(page);
      results.push(result);
    }

    logger.info(`批量创建或更新了 ${results.length} 个页面`);
    return results;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`批量创建或更新 PageV2 失败: ${errorMessage}`);
    throw error;
  }
}

/**
 * Update PageV2 record
 * @param id PageV2 ID
 * @param params update parameters
 * @returns updated PageV2 record
 */
export async function updatePageV2(id: string, params: PageV2UpdateParams) {
  try {
    const updateData: any = {};

    if (params.name !== undefined) {
      updateData.name = params.name;
    }
    if (params.title !== undefined) {
      updateData.title = params.title;
    }
    if (params.content !== undefined) {
      updateData.content = params.content;
    }
    if (params.actionIds !== undefined) {
      updateData.actionIds = params.actionIds;
    }
    if (params.headMeta !== undefined) {
      updateData.headMeta = params.headMeta;
    }
    if (params.headLinks !== undefined) {
      updateData.headLinks = params.headLinks;
    }
    if (params.headScripts !== undefined) {
      updateData.headScripts = params.headScripts;
    }
    if (params.headStyles !== undefined) {
      updateData.headStyles = params.headStyles;
    }
    if (params.headRaw !== undefined) {
      updateData.headRaw = params.headRaw;
    }
    if (params.sort !== undefined) {
      updateData.sort = params.sort;
    }

    const updatedPage = await prisma.pageV2.update({
      where: { id },
      data: updateData,
    });

    logger.info(`更新了 PageV2: ${id}`);
    return updatedPage;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`更新 PageV2 ${id} 失败: ${errorMessage}`);
    throw error;
  }
}

/**
 * Update PageV2 record by message ID and page name
 * @param messageId message ID
 * @param name page name
 * @param params update parameters
 * @returns updated PageV2 record
 */
export async function updatePageV2ByMessageIdAndName(messageId: string, name: string, params: PageV2UpdateParams) {
  try {
    const existingPage = await getPageV2ByMessageIdAndName(messageId, name);

    if (!existingPage) {
      throw new Error(`PageV2 not found: messageId=${messageId}, name=${name}`);
    }

    return await updatePageV2(existingPage.id, params);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`更新消息 ${messageId} 的页面 ${name} 失败: ${errorMessage}`);
    throw error;
  }
}

/**
 * Delete PageV2 record
 * @param id PageV2 ID
 * @returns delete result
 */
export async function deletePageV2(id: string) {
  try {
    await prisma.pageV2.delete({
      where: { id },
    });

    logger.info(`删除了 PageV2: ${id}`);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`删除 PageV2 ${id} 失败: ${errorMessage}`);
    throw error;
  }
}

/**
 * Delete all PageV2 records by message ID
 * @param messageId message ID
 * @returns delete result
 */
export async function deletePageV2ByMessageId(messageId: string) {
  try {
    await prisma.pageV2.deleteMany({
      where: { messageId },
    });

    logger.info(`删除了消息 ${messageId} 的所有 PageV2 记录`);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`删除消息 ${messageId} 的 PageV2 失败: ${errorMessage}`);
    throw error;
  }
}

/**
 * Delete specific PageV2 record by message ID and page name
 * @param messageId message ID
 * @param name page name
 * @returns delete result
 */
export async function deletePageV2ByMessageIdAndName(messageId: string, name: string) {
  try {
    await prisma.pageV2.deleteMany({
      where: {
        messageId,
        name,
      },
    });

    logger.info(`删除了消息 ${messageId} 的页面: ${name}`);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`删除消息 ${messageId} 的页面 ${name} 失败: ${errorMessage}`);
    throw error;
  }
}

/**
 * Migrate Page V1 data to PageV2 format
 * @param messageId message ID
 * @param pagesV1 Page V1 pages array (JSON)
 * @param userId user ID (for resource storage path)
 * @returns created PageV2 records array
 */
export async function migratePageV1ToV2(messageId: string, pagesV1: any, userId?: string) {
  try {
    const pagesArray = JSON.parse(JSON.stringify(pagesV1)) as PageV1[];

    if (!pagesArray || pagesArray.length === 0) {
      logger.warn(`迁移 Page V1: 消息 ${messageId} 没有页面数据`);
      return [];
    }

    // convert to PageV2 format and create
    const createParams: PageV2CreateParams[] = pagesArray.map((pageV1, index) => ({
      messageId,
      name: pageV1.name,
      title: pageV1.title,
      content: pageV1.content || '',
      actionIds: pageV1.actionIds || [],
      sort: index,
      headMeta: undefined,
      headLinks: undefined,
      headScripts: undefined,
      headStyles: undefined,
      headRaw: undefined,
    }));

    const createdPages = await createPagesV2(createParams);

    // if userId is provided, extract and save resources
    if (userId) {
      await extractAndSaveResourcesForPages(createdPages, userId, messageId);
    }

    // create pageName -> PageV2.id mapping
    const pageNameToIdMap = new Map<string, string>();
    createdPages.forEach((page) => {
      pageNameToIdMap.set(page.name, page.id);
    });

    // update sections of the message, associate pageV2Id with the corresponding PageV2
    const sections = await prisma.section.findMany({
      where: { messageId },
    });

    if (sections.length > 0) {
      const updatePromises = sections.map((section) => {
        const pageV2Id = pageNameToIdMap.get(section.pageName);
        if (pageV2Id) {
          return prisma.section.update({
            where: { id: section.id },
            data: { pageV2Id },
          });
        }
        return null;
      });

      const updateResults = await Promise.all(updatePromises.filter((p) => p !== null));
      logger.info(`迁移时更新了 ${updateResults.length} 个 Section 的 pageV2Id 字段`);
    }

    logger.info(`成功将消息 ${messageId} 的 ${createdPages.length} 个 Page V1 页面迁移到 PageV2`);
    return createdPages;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`迁移 Page V1 到 PageV2 失败 (messageId: ${messageId}): ${errorMessage}`);
    throw error;
  }
}

/**
 * Extract and save resources for created PageV2 records
 * @param pages PageV2 records array
 * @param userId user ID
 * @param messageId message ID
 */
async function extractAndSaveResourcesForPages(
  pages: Awaited<ReturnType<typeof createPagesV2>>,
  userId: string,
  messageId: string,
) {
  for (const page of pages) {
    try {
      const html = page.content;
      if (!html) {
        continue;
      }

      // extract data URL resources
      const dataUrlResources = extractDataUrlResources(html);

      if (dataUrlResources.length === 0) {
        logger.debug(`页面 ${page.name} 没有需要提取的 data URL 资源`);
        continue;
      }

      logger.info(`页面 ${page.name} 发现 ${dataUrlResources.length} 个 data URL 资源`);

      const assetDirPath = getAssetDirPath(userId, messageId);
      const pathReplacements = new Map<string, string>();
      const assetsToCreate: PageAssetCreateParams[] = [];

      for (const resource of dataUrlResources) {
        if (!resource.binaryContent || !resource.suggestedFilename) {
          continue;
        }

        try {
          const uploadResult = await storageProvider.uploadFile({
            dirs: assetDirPath,
            contentType: resource.mimeType || getMimeType(resource.suggestedFilename),
            filename: resource.suggestedFilename,
            data: resource.binaryContent,
            keepOriginalFilename: false,
          });

          const storagePath = getAssetStoragePath(userId, messageId, uploadResult.filename);
          const url = getAssetUrl(storagePath);

          pathReplacements.set(resource.originalPath, url);

          assetsToCreate.push({
            pageId: page.id,
            filename: uploadResult.filename,
            storagePath,
            url,
            fileType: uploadResult.contentType,
            fileSize: uploadResult.size,
            sort: 0,
          });

          logger.debug(`成功保存资源: ${uploadResult.filename}`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '未知错误';
          logger.error(`保存资源失败: ${resource.suggestedFilename} ${errorMessage}`);
        }
      }

      if (assetsToCreate.length > 0) {
        await createPageAssets(assetsToCreate);
        logger.info(`为页面 ${page.name} 创建了 ${assetsToCreate.length} 个资源记录`);
      }

      if (pathReplacements.size > 0) {
        const updatedHtml = replaceResourcePaths(html, pathReplacements);
        await updatePageV2(page.id, { content: updatedHtml });
        logger.info(`更新了页面 ${page.name} 的资源路径`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logger.error(`处理页面 ${page.name} 的资源时出错: ${errorMessage}`);
    }
  }
}
