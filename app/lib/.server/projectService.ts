import { createScopedLogger } from '~/lib/.server/logger';
import type { Page } from '~/types/actions';
import { createOrUpdatePages, getPageByMessageId } from './page';
import { createSection, deleteMessageSections, getMessageSections, type SectionCreateParams } from './section';

const logger = createScopedLogger('projectService');

/**
 * 保存项目数据接口
 */
export interface SaveProjectParams {
  messageId: string;
  projectData: Record<string, any>;
}

/**
 * 保存项目部分接口
 */
export interface SaveSectionsParams {
  messageId: string;
  sections: SectionCreateParams[];
}

/**
 * 保存页面数据接口
 */
export interface SavePagesParams {
  messageId: string;
  pages: Page[];
}

/**
 * 保存项目和部分数据接口
 */
export interface SaveProjectAndSectionsParams {
  messageId: string;
  projectData: Record<string, any>;
  sections: SectionCreateParams[];
}

/**
 * 保存页面和部分数据接口
 */
export interface SavePagesAndSectionsParams {
  messageId: string;
  pages: Page[];
  sections: SectionCreateParams[];
}

/**
 * 保存页面数据
 * @param params 保存页面参数
 * @returns 保存结果
 */
export async function savePages(params: SavePagesParams) {
  const { messageId, pages } = params;

  try {
    // 检查页面是否已存在
    const existingPage = await getPageByMessageId(messageId);

    // 创建或更新页面
    const page = await createOrUpdatePages(messageId, pages);

    if (existingPage) {
      logger.info(`更新了消息 ${messageId} 的页面`);
      return { success: true, message: '页面已更新', id: page.id };
    } else {
      logger.info(`创建了消息 ${messageId} 的页面: ${page.id}`);
      return { success: true, message: '页面已创建', id: page.id };
    }
  } catch (error) {
    logger.error('保存页面数据失败:', error);
    throw error;
  }
}

/**
 * 保存项目部分数据
 * @param params 保存部分参数
 * @returns 保存结果
 */
export async function saveSections(params: SaveSectionsParams) {
  const { messageId, sections } = params;

  try {
    // 获取现有部分
    const existingSections = await getMessageSections(messageId);

    // 如果有现有部分，则先删除
    if (existingSections.length > 0) {
      await deleteMessageSections(messageId);
      logger.info(`删除了消息 ${messageId} 的现有部分数据`);
    }

    // 创建新部分
    const createdSections = await Promise.all(
      sections.map((section) =>
        createSection({
          ...section,
          messageId,
        }),
      ),
    );

    logger.info(`为消息 ${messageId} 创建了 ${createdSections.length} 个部分`);
    return {
      success: true,
      message: `已保存 ${createdSections.length} 个部分`,
      count: createdSections.length,
    };
  } catch (error) {
    logger.error('保存部分数据失败:', error);
    throw error;
  }
}

/**
 * 保存页面和部分数据
 * @param params 保存页面和部分参数
 * @returns 保存结果
 */
export async function savePagesAndSections(params: SavePagesAndSectionsParams) {
  const { messageId, pages, sections } = params;

  try {
    // 保存页面数据
    const pagesResult = await savePages({ messageId, pages });

    // 保存部分数据
    const sectionsResult = await saveSections({ messageId, sections });

    return {
      success: true,
      pages: pagesResult,
      sections: sectionsResult,
    };
  } catch (error) {
    logger.error('保存页面和部分数据失败:', error);
    throw error;
  }
}
