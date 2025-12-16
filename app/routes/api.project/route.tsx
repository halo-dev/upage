import { type ActionFunctionArgs } from '@remix-run/node';
import type { PageV2CreateParams } from '~/.server/service/page-v2';
import { saveOrUpdateProject } from '~/.server/service/project-service';
import type { SectionCreateParams } from '~/.server/service/section';
import { errorResponse, successResponse } from '~/.server/utils/api-response';
import { createScopedLogger } from '~/.server/utils/logger';

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

    let pages: PageV2CreateParams[];
    let sections: SectionCreateParams[];

    try {
      pages = JSON.parse(pagesStr);
      pages = pages.map((page) => ({
        ...page,
        messageId,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logger.error(`项目数据解析失败: ${errorMessage}`);
      return errorResponse(400, '项目数据格式无效');
    }

    try {
      sections = JSON.parse(sectionsStr);
      sections = sections.map((section) => ({
        ...section,
        messageId,
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logger.error(`sections数据解析失败: ${errorMessage}`);
      return errorResponse(400, 'sections数据格式无效');
    }

    const result = await saveOrUpdateProject(pages, sections);

    return successResponse(result, '项目保存成功');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`处理项目保存请求失败: ${errorMessage}`);
    return errorResponse(500, '项目保存失败');
  }
}
