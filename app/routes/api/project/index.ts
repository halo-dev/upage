import { type ActionFunctionArgs } from 'react-router';
import { requireAuth } from '~/.server/service/auth';
import type { PageV2CreateParams } from '~/.server/service/page-v2';
import { prisma } from '~/.server/service/prisma';
import { saveOrUpdateProject } from '~/.server/service/project-service';
import type { SectionCreateParams } from '~/.server/service/section';
import { errorResponse, successResponse } from '~/.server/utils/api-response';
import { createScopedLogger } from '~/.server/utils/logger';

const logger = createScopedLogger('api.project');

export async function action({ request }: ActionFunctionArgs) {
  const authResult = await requireAuth(request, { isApi: true });
  if (authResult instanceof Response) {
    return authResult;
  }

  const userId = authResult.userInfo?.sub;
  if (!userId) {
    return errorResponse(401, '用户未登录');
  }

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

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        chat: {
          select: {
            userId: true,
          },
        },
      },
    });
    if (!message) {
      logger.warn(`项目保存失败: 消息 ${messageId} 不存在，可能是响应已中止或消息尚未持久化`);
      return errorResponse(400, '当前消息尚未保存，无法保存项目，请等待响应完成后重试');
    }
    if (message.chat.userId !== userId) {
      logger.warn(`项目保存失败: 用户 ${userId} 无权保存消息 ${messageId} 的项目数据`);
      return errorResponse(403, '无权保存当前项目');
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
