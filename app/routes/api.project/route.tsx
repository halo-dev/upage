import { type ActionFunctionArgs } from '@remix-run/node';
import type { PageCreateParams } from '~/.server/service/page';
import { savePagesAndSections } from '~/.server/service/project-service';
import type { SectionCreateParams } from '~/.server/service/section';
import { errorResponse, successResponse } from '~/.server/utils/api-response';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.project');

export async function action({ request }: ActionFunctionArgs) {
  try {
    if (request.method !== 'POST') {
      return errorResponse(405, '不支持的请求方法');
    }

    const formData = await request.formData();
    const messageId = formData.get('messageId')?.toString();
    const pagesStr = formData.get('pages')?.toString();
    const sectionsStr = formData.get('sections')?.toString();

    if (!messageId) {
      return errorResponse(400, '消息 ID 不能为空');
    }
    if (!pagesStr) {
      return errorResponse(400, 'pages 数据不能为空');
    }
    if (!sectionsStr) {
      return errorResponse(400, 'sections 不能为空');
    }

    let pages: PageCreateParams[];
    let sections: SectionCreateParams[];

    try {
      pages = JSON.parse(pagesStr);
      pages = pages.map((page) => ({
        ...page,
        messageId,
      })) as PageCreateParams[];
    } catch (e) {
      logger.error('项目数据解析失败', e);
      return errorResponse(400, '项目数据格式无效');
    }

    try {
      sections = JSON.parse(sectionsStr);
      sections = sections.map((section) => ({
        ...section,
        messageId,
      })) as SectionCreateParams[];
    } catch (e) {
      logger.error('sections数据解析失败', e);
      return errorResponse(400, 'sections数据格式无效');
    }

    const result = await savePagesAndSections({
      messageId,
      pages,
      sections,
    });

    return successResponse(result, '项目保存成功');
  } catch (error) {
    logger.error('处理项目保存请求失败:', error);
    return errorResponse(500, '服务器处理请求失败');
  }
}
