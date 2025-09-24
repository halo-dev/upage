import { createScopedLogger } from '~/lib/.server/logger';
import { prisma } from '~/lib/.server/prisma';
import type { Section } from '~/types/actions';

const logger = createScopedLogger('section.server');

/**
 * section 创建参数接口
 */
export interface SectionCreateParams extends Section {
  messageId: string;
  actionId: string;
}

/**
 * section 更新参数接口
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
}

/**
 * 创建新的 section
 * @param params  section 创建参数
 * @returns 创建的 section 记录
 */
export async function createSection(params: SectionCreateParams) {
  const { messageId, action = 'add', actionId, pageName = '', content, domId, rootDomId, sort = 0 } = params;

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
      },
    });

    logger.info(`[Section] 创建了消息 ${messageId} 的 section : ${section.id}`);
    return section;
  } catch (error) {
    logger.error('[Section] 创建 section 失败:', error);
    throw error;
  }
}

/**
 * 批量创建多个 section
 * @param params  section 创建参数数组
 * @returns 创建的 section 数量
 */
export async function createManySections(params: SectionCreateParams[]) {
  if (!params || params.length === 0) {
    logger.warn('[Section] 批量创建 section : 没有提供 section 数据');
    return 0;
  }

  try {
    const result = await prisma.section.createMany({
      data: params.map(
        ({ messageId, action = 'add', actionId, pageName = '', content, domId, rootDomId, sort = 0 }) => ({
          messageId,
          action,
          actionId,
          pageName,
          content,
          domId,
          rootDomId,
          sort,
        }),
      ),
    });

    logger.info(`[Section] 批量创建了 ${result.count} 个 section `);
    return result.count;
  } catch (error) {
    logger.error('[Section] 批量创建 section 失败:', error);
    throw error;
  }
}

/**
 * 根据ID获取 section
 * @param id  section ID
 * @returns  section 记录
 */
export async function getSectionById(id: string) {
  try {
    const section = await prisma.section.findUnique({
      where: { id },
    });

    return section;
  } catch (error) {
    logger.error(`[Section] 获取 section  ${id} 失败:`, error);
    throw error;
  }
}

/**
 * 获取消息的所有 section
 * @param messageId 消息ID
 * @returns  section 记录列表
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
    logger.error(`[Section] 获取消息 ${messageId} 的 section 列表失败:`, error);
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
    logger.error(`[Section] 获取DOM ID ${domId} 的 section 失败:`, error);
    throw error;
  }
}

/**
 * 获取特定页面的所有 section
 * @param pageName 页面名称
 * @returns  section 记录列表
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
    logger.error(`[Section] 获取页面 ${pageName} 的 section 列表失败:`, error);
    throw error;
  }
}

/**
 * 更新 section 信息
 * @param id  section ID
 * @param params 更新参数
 * @returns 更新后的 section 记录
 */
export async function updateSection(id: string, params: SectionUpdateParams) {
  try {
    const updatedSection = await prisma.section.update({
      where: { id },
      data: {
        ...params,
      },
    });

    logger.info(`[Section] 更新了 section  ${id}`);
    return updatedSection;
  } catch (error) {
    logger.error(`[Section] 更新 section  ${id} 失败:`, error);
    throw error;
  }
}

/**
 * 删除 section
 * @param id  section ID
 * @returns 删除结果
 */
export async function deleteSection(id: string) {
  try {
    await prisma.section.delete({
      where: { id },
    });

    logger.info(`[Section] 删除了 section  ${id}`);
    return true;
  } catch (error) {
    logger.error(`[Section] 删除 section  ${id} 失败:`, error);
    throw error;
  }
}

/**
 * 删除消息的所有 section
 * @param messageId 消息ID
 * @returns 删除结果
 */
export async function deleteMessageSections(messageId: string) {
  try {
    const result = await prisma.section.deleteMany({
      where: { messageId },
    });

    logger.info(`[Section] 删除了消息 ${messageId} 的 ${result.count} 个 section `);
    return result.count > 0;
  } catch (error) {
    logger.error(`[Section] 删除消息 ${messageId} 的 section 失败:`, error);
    throw error;
  }
}
