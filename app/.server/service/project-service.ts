import { createScopedLogger } from '~/.server/utils/logger';
import { createOrUpdatePagesV2, type PageV2CreateParams } from './page-v2';
import { createOrUpdateManySections, type SectionCreateParams } from './section';

const logger = createScopedLogger('projectService');

/**
 * Save pages data
 *
 * @param params save pages parameters
 * @returns save result
 */
async function saveOrUpdatePages(pages: PageV2CreateParams[]) {
  try {
    const createdPages = await createOrUpdatePagesV2(pages);

    if (createdPages) {
      logger.info(`批量创建或更新了 ${createdPages.length} 个页面`);
      return createdPages;
    } else {
      logger.error('保存页面数据失败: 页面创建或更新失败');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`保存页面数据失败: ${errorMessage}`);
    throw error;
  }
}

/**
 * Save project sections data
 *
 * @param params save sections parameters
 * @returns save result
 */
async function saveOrUpdateSections(sections: SectionCreateParams[]) {
  try {
    // batch create saveSections
    const savedSections = await createOrUpdateManySections(sections);

    if (savedSections) {
      logger.info(`批量创建或更新了 ${savedSections.length} 个部分`);
      return savedSections;
    } else {
      logger.error('保存部分数据失败: 部分创建或更新失败');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`保存部分数据失败: ${errorMessage}`);
    throw error;
  }
}

/**
 * Save pages and sections data
 *
 * @param params save pages and sections parameters
 */
export async function saveOrUpdateProject(pages: PageV2CreateParams[], sections: SectionCreateParams[]) {
  try {
    const validPages = pages.filter((page) => page.name && page.content);
    const validSections = sections.filter((section) => section.pageName && section.content);

    if (validPages.length === 0 || validSections.length === 0) {
      throw new Error('保存页面和部分数据失败: 页面或部分数据无效');
    }

    // save or update pages
    const pagesResult = await saveOrUpdatePages(validPages);
    const pageV2IdMap = new Map(pagesResult?.map((page) => [page.name, page.id]) || []);

    const saveSections: SectionCreateParams[] = validSections.map((section) => {
      const pageV2Id = pageV2IdMap.get(section.pageName);
      return {
        ...section,
        pageV2Id: pageV2Id || undefined,
      };
    });
    const sectionsResult = await saveOrUpdateSections(saveSections);
    return {
      success: true,
      pages: pagesResult,
      sections: sectionsResult,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`保存页面和部分数据失败: ${errorMessage}`);
    throw error;
  }
}
