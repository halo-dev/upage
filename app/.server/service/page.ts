import type { JsonArray, JsonObject } from '@prisma/client/runtime/library';
import { createScopedLogger } from '~/.server/utils/logger';
import type { Page } from '~/types/actions';
import { prisma } from './prisma';

const logger = createScopedLogger('page.server');

/**
 * 页面创建参数接口
 *
 * @deprecated 使用 PageData 代替
 */
export interface PageCreateParams extends Page {
  messageId: string;
}

/**
 * 页面更新参数接口
 *
 * @deprecated 使用 PageData 代替
 */
export interface PageUpdateParams {
  pages?: Page[];
}

/**
 * 创建新的页面
 * @param params 页面创建参数
 * @returns 创建的页面记录
 *
 * @deprecated 使用 PageV2 createPageV2 代替
 */
export async function createPage(params: PageCreateParams) {
  const { messageId, name, title, content, actionIds } = params;

  try {
    const pageData = [
      {
        name,
        title,
        content,
        actionIds,
      },
    ];

    const page = await prisma.page.create({
      data: {
        messageId,
        pages: JSON.parse(JSON.stringify(pageData)),
      },
    });

    logger.info(`[Page] 创建了消息 ${messageId} 的页面: ${page.id}`);
    return page;
  } catch (error) {
    logger.error('[Page] 创建页面失败:', error);
    throw error;
  }
}

/**
 * 创建或更新页面
 * @param params 页面创建参数
 * @returns 创建或更新的页面记录
 *
 * @deprecated 使用 PageV2 createOrUpdatePageV2 代替
 */
export async function createOrUpdatePage(params: PageCreateParams) {
  const { messageId, name, title, content, actionIds } = params;

  try {
    const existingPage = await getPageByMessageId(messageId);

    if (existingPage) {
      const updatedPage = await updatePageByMessageId(messageId, {
        pages: [
          {
            name,
            title,
            content,
            actionIds,
          },
        ],
      });
      return updatedPage;
    }
    const newPage = await createPage(params);
    return newPage;
  } catch (error) {
    logger.error('[Page] 创建或更新页面失败:', error);
    throw error;
  }
}

/**
 * 创建多个页面
 * @param messageId 消息ID
 * @param pages 页面数组
 * @returns 创建的页面记录
 *
 * @deprecated 使用 PageV2 createPagesV2 代替
 */
export async function createPages(messageId: string, pages: Page[]) {
  try {
    const page = await prisma.page.create({
      data: {
        messageId,
        pages: JSON.parse(JSON.stringify(pages)),
      },
    });

    logger.info(`[Page] 为消息 ${messageId} 创建了 ${pages.length} 个页面: ${page.id}`);
    return page;
  } catch (error) {
    logger.error('[Page] 创建多个页面失败:', error);
    throw error;
  }
}

/**
 * 创建或更新多个页面
 * @param messageId 消息ID
 * @param pages 页面数组
 * @returns 创建或更新的页面记录
 *
 * @deprecated 使用 PageV2 createOrUpdatePagesV2 代替
 */
export async function createOrUpdatePages(messageId: string, pages: Page[]) {
  try {
    const existingPage = await getPageByMessageId(messageId);
    if (existingPage) {
      const updatedPage = await updatePageByMessageId(messageId, { pages });
      return updatedPage;
    }
    const newPage = await createPages(messageId, pages);
    return newPage;
  } catch (error) {
    logger.error('[Page] 创建或更新多个页面失败:', error);
    throw error;
  }
}

/**
 * 根据ID获取页面
 * @param id 页面ID
 * @returns 页面记录
 *
 * @deprecated 使用 PageV2 getPageV2ById 代替
 */
export async function getPageById(id: string) {
  try {
    const page = await prisma.page.findUnique({
      where: { id },
    });

    return page;
  } catch (error) {
    logger.error(`[Page] 获取页面 ${id} 失败:`, error);
    throw error;
  }
}

/**
 * 根据消息ID获取页面
 * @param messageId 消息ID
 * @returns 页面记录
 *
 * @deprecated 使用 PageV2 getPageV2ByMessageId 代替
 */
export async function getPageByMessageId(messageId: string) {
  try {
    const page = await prisma.page.findUnique({
      where: { messageId },
    });

    return page;
  } catch (error) {
    logger.error(`[Page] 获取消息 ${messageId} 的页面失败:`, error);
    throw error;
  }
}

/**
 * 根据消息ID和页面名称获取页面
 * @param messageId 消息ID
 * @param name 页面名称
 * @returns 页面记录
 *
 * @deprecated 使用 PageV2 getPageV2ByMessageIdAndName 代替
 */
export async function getPageByMessageIdAndName(messageId: string, name: string): Promise<JsonObject | null> {
  try {
    const page = await getPageByMessageId(messageId);
    if (!page) {
      return null;
    }
    const pages = page.pages as JsonArray;
    const pageData = pages.find((p) => {
      const page = p as JsonObject;
      return page.name === name;
    });
    if (!pageData) {
      return null;
    }
    return pageData as JsonObject;
  } catch (error) {
    logger.error(`[Page] 获取消息 ${messageId} 的页面 ${name} 失败:`, error);
    throw error;
  }
}

/**
 * 更新页面信息
 * @param id 页面ID
 * @param params 更新参数
 * @returns 更新后的页面记录
 *
 * @deprecated 使用 PageV2 updatePageV2 代替
 */
export async function updatePage(id: string, params: PageUpdateParams) {
  try {
    const updateData: any = {};

    if (params.pages) {
      updateData.pages = JSON.parse(JSON.stringify(params.pages));
    }

    const updatedPage = await prisma.page.update({
      where: { id },
      data: updateData,
    });

    logger.info(`[Page] 更新了页面 ${id}`);
    return updatedPage;
  } catch (error) {
    logger.error(`[Page] 更新页面 ${id} 失败:`, error);
    throw error;
  }
}

/**
 * 根据消息ID更新页面信息
 * @param messageId 消息ID
 * @param params 更新参数
 * @returns 更新后的页面记录
 *
 * @deprecated 使用 PageV2 updatePageV2ByMessageId 代替
 */
export async function updatePageByMessageId(messageId: string, params: PageUpdateParams) {
  try {
    const updateData: any = {};

    if (params.pages) {
      updateData.pages = JSON.parse(JSON.stringify(params.pages));
    }

    const updatedPage = await prisma.page.update({
      where: { messageId },
      data: updateData,
    });

    logger.info(`[Page] 更新了消息 ${messageId} 的页面`);
    return updatedPage;
  } catch (error) {
    logger.error(`[Page] 更新消息 ${messageId} 的页面失败:`, error);
    throw error;
  }
}

/**
 * 删除页面
 * @param id 页面ID
 * @returns 删除结果
 *
 * @deprecated 使用 PageV2 deletePageV2 代替
 */
export async function deletePage(id: string) {
  try {
    await prisma.page.delete({
      where: { id },
    });

    logger.info(`[Page] 删除了页面 ${id}`);
    return true;
  } catch (error) {
    logger.error(`[Page] 删除页面 ${id} 失败:`, error);
    throw error;
  }
}

/**
 * 根据消息ID删除页面
 * @param messageId 消息ID
 * @returns 删除结果
 *
 * @deprecated 使用 PageV2 deletePageV2ByMessageId 代替
 */
export async function deletePageByMessageId(messageId: string) {
  try {
    await prisma.page.delete({
      where: { messageId },
    });

    logger.info(`[Page] 删除了消息 ${messageId} 的页面`);
    return true;
  } catch (error) {
    logger.error(`[Page] 删除消息 ${messageId} 的页面失败:`, error);
    throw error;
  }
}
