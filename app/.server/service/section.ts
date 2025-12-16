import { prisma } from '~/.server/service/prisma';
import { createScopedLogger } from '~/.server/utils/logger';
import type { Section } from '~/types/actions';

const logger = createScopedLogger('section.server');

/**
 * Section create parameters interface
 */
export interface SectionCreateParams extends Section {
  messageId: string;
  actionId: string;
  pageV2Id?: string;
  placement?: string;
  type?: string;
}

/**
 * Section update parameters interface
 */
export interface SectionUpdateParams {
  type?: string;
  action?: string;
  actionId?: string;
  pageName?: string;
  content?: string;
  domId?: string;
  rootDomId?: string;
  sort?: number;
  pageV2Id?: string;
  placement?: string;
}

/**
 * Create new section
 * @param params section create parameters
 * @returns created section record
 */
export async function createSection(params: SectionCreateParams) {
  const {
    messageId,
    action = 'add',
    actionId,
    pageName = '',
    content,
    domId,
    rootDomId,
    sort = 0,
    pageV2Id,
    placement = 'body',
    type = 'section',
  } = params;

  try {
    const section = await prisma.section.create({
      data: {
        messageId,
        action,
        actionId,
        pageName,
        content,
        domId,
        rootDomId,
        sort,
        pageV2Id: pageV2Id || undefined,
        placement,
        type,
      },
    });

    logger.info(`创建了消息 ${messageId} 的 section : ${section.id}`);
    return section;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`创建 section 失败: ${errorMessage}`);
    throw error;
  }
}

/**
 * Create or update section
 * @param params section create parameters
 * @returns created or updated section record
 */
export async function createOrUpdateSection(params: SectionCreateParams) {
  const {
    messageId,
    action = 'add',
    actionId,
    pageName = '',
    content,
    domId,
    rootDomId,
    sort = 0,
    pageV2Id,
    placement = 'body',
    type = 'section',
  } = params;

  try {
    const existingSection = await getSectionByMessageIdAndDomId(messageId, domId);

    if (existingSection) {
      const updatedSection = await updateSection(existingSection.id, {
        action,
        actionId,
        pageName,
        content,
        rootDomId,
        sort,
        pageV2Id,
        placement,
        type,
      });
      logger.info(`更新了消息 ${messageId} 的 section: ${existingSection.id} (domId: ${domId})`);
      return updatedSection;
    }

    const newSection = await createSection(params);
    return newSection;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`创建或更新 section 失败: ${errorMessage}`);
    throw error;
  }
}

/**
 * Batch create multiple sections
 * @param params section create parameters array
 * @returns created section count
 */
export async function createManySections(params: SectionCreateParams[]) {
  if (!params || params.length === 0) {
    logger.warn(`批量创建 section : 没有提供 section 数据`);
    return 0;
  }

  try {
    const result = await prisma.section.createMany({
      data: params.map(
        ({
          messageId,
          action = 'add',
          actionId,
          pageName = '',
          content,
          domId,
          rootDomId,
          sort = 0,
          pageV2Id,
          placement = 'body',
          type = 'section',
        }) => ({
          messageId,
          action,
          actionId,
          pageName,
          content,
          domId,
          rootDomId,
          sort,
          pageV2Id: pageV2Id || undefined,
          placement,
          type,
        }),
      ),
    });

    logger.info(`批量创建了 ${result.count} 个 section `);
    return result.count;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`批量创建 section 失败: ${errorMessage}`);
    throw error;
  }
}

/**
 * Batch create or update sections
 * @param params section create parameters array
 * @returns created or updated section records array
 */
export async function createOrUpdateManySections(params: SectionCreateParams[]) {
  if (!params || params.length === 0) {
    logger.warn(`批量创建或更新 section : 没有提供 section 数据`);
    return [];
  }

  try {
    const results = [];

    for (const param of params) {
      const result = await createOrUpdateSection(param);
      results.push(result);
    }

    logger.info(`批量创建或更新了 ${results.length} 个 section`);
    return results;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`批量创建或更新 section 失败: ${errorMessage}`);
    throw error;
  }
}

/**
 * Get section by ID
 * @param id  section ID
 * @returns section record
 */
export async function getSectionById(id: string) {
  try {
    const section = await prisma.section.findUnique({
      where: { id },
    });

    return section;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`获取 section  ${id} 失败: ${errorMessage}`);
    throw error;
  }
}

/**
 * Get all sections by message ID
 * @param messageId message ID
 * @returns section records array
 */
export async function getMessageSections(messageId: string) {
  try {
    const sections = await prisma.section.findMany({
      where: { messageId },
      orderBy: {
        sort: 'asc',
      },
    });

    return sections;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`获取消息 ${messageId} 的 section 列表失败: ${errorMessage}`);
    throw error;
  }
}

/**
 * 根据DOM ID获取 section
 * @param domId DOM ID
 * @returns  section 记录
 */
export async function getSectionByDomId(domId: string) {
  try {
    const sections = await prisma.section.findMany({
      where: { domId },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return sections;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`获取DOM ID ${domId} 的 section 失败: ${errorMessage}`);
    throw error;
  }
}

/**
 * Get section by message ID and DOM ID
 * @param messageId message ID
 * @param domId DOM ID
 * @returns section record or null
 */
export async function getSectionByMessageIdAndDomId(messageId: string, domId: string) {
  try {
    const section = await prisma.section.findFirst({
      where: {
        messageId,
        domId,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return section;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`获取消息 ${messageId} DOM ID ${domId} 的 section 失败: ${errorMessage}`);
    throw error;
  }
}

/**
 * Get all sections by page name
 * @param pageName page name
 * @returns section records array
 */
export async function getPageSections(pageName: string) {
  try {
    const sections = await prisma.section.findMany({
      where: { pageName },
      orderBy: {
        sort: 'asc',
      },
    });

    return sections;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`获取页面 ${pageName} 的 section 列表失败: ${errorMessage}`);
    throw error;
  }
}

/**
 * Update section information
 * @param id  section ID
 * @param params update parameters
 * @returns updated section record
 */
export async function updateSection(id: string, params: SectionUpdateParams) {
  try {
    const updatedSection = await prisma.section.update({
      where: { id },
      data: {
        ...params,
      },
    });

    logger.info(`更新了 section  ${id}`);
    return updatedSection;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`更新 section  ${id} 失败: ${errorMessage}`);
    throw error;
  }
}

/**
 * Delete section by ID
 * @param id  section ID
 * @returns delete result
 */
export async function deleteSection(id: string) {
  try {
    await prisma.section.delete({
      where: { id },
    });

    logger.info(`删除了 section  ${id}`);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`删除 section  ${id} 失败: ${errorMessage}`);
    throw error;
  }
}

/**
 * Delete all sections by message ID
 * @param messageId message ID
 * @returns delete result
 */
export async function deleteMessageSections(messageId: string) {
  try {
    const result = await prisma.section.deleteMany({
      where: { messageId },
    });

    logger.info(`删除了消息 ${messageId} 的 ${result.count} 个 section `);
    return result.count > 0;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`删除消息 ${messageId} 的 section 失败: ${errorMessage}`);
    throw error;
  }
}

/**
 * Get all sections by PageV2 ID
 * @param pageV2Id PageV2 ID
 * @returns section records array
 */
export async function getSectionsByPageV2Id(pageV2Id: string) {
  try {
    const sections = await prisma.section.findMany({
      where: { pageV2Id },
      orderBy: {
        sort: 'asc',
      },
    });

    return sections;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`获取 PageV2 ${pageV2Id} 的 section 列表失败: ${errorMessage}`);
    throw error;
  }
}

/**
 * Get sections by message ID and page name
 * @param messageId message ID
 * @param pageName page name
 * @returns section records array
 */
export async function getSectionsByMessageIdAndPageName(messageId: string, pageName: string) {
  try {
    const sections = await prisma.section.findMany({
      where: {
        messageId,
        pageName,
      },
      orderBy: {
        sort: 'asc',
      },
    });

    return sections;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`获取消息 ${messageId} 页面 ${pageName} 的 section 列表失败: ${errorMessage}`);
    throw error;
  }
}

/**
 * Delete all sections by PageV2 ID
 * @param pageV2Id PageV2 ID
 * @returns delete result
 */
export async function deleteSectionsByPageV2Id(pageV2Id: string) {
  try {
    const result = await prisma.section.deleteMany({
      where: { pageV2Id },
    });

    logger.info(`删除了 PageV2 ${pageV2Id} 的 ${result.count} 个 section `);
    return result.count > 0;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`删除 PageV2 ${pageV2Id} 的 section 失败: ${errorMessage}`);
    throw error;
  }
}
