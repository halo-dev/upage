import type { ActionFunctionArgs } from 'react-router';
import { deleteChat, getUserChatById } from '~/.server/service/chat';
import { errorResponse, successResponse } from '~/.server/utils/api-response';
import { createScopedLogger } from '~/.server/utils/logger';

const logger = createScopedLogger('api.chat.delete');

export type HandleDeleteActionArgs = ActionFunctionArgs & {
  userId: string;
};

/**
 * 处理删除聊天操作
 */
export async function handleDeleteAction({ request, userId }: HandleDeleteActionArgs) {
  if (request.method !== 'DELETE' && request.method !== 'POST') {
    return errorResponse(405, '请求方法不支持');
  }

  try {
    // 获取请求数据
    const formData = await request.formData();
    const id = formData.get('id')?.toString();
    const idsString = formData.get('ids')?.toString();

    let ids: string[] | undefined;
    if (idsString) {
      try {
        ids = JSON.parse(idsString);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        logger.error(`解析 ids 参数失败: ${errorMessage}`);
        return errorResponse(400, 'ids 参数格式无效');
      }
    }

    if (!id && (!ids || !Array.isArray(ids) || ids.length === 0)) {
      return errorResponse(400, '缺少有效的聊天ID');
    }

    if (id) {
      const chat = await getUserChatById(id, userId);
      if (!chat) {
        return errorResponse(404, '未找到聊天记录或无权限操作');
      }

      await deleteChat(id);
      logger.debug(`用户 ${userId} 删除了聊天 ${id}`);

      return successResponse(id, '删除聊天成功');
    }

    const idsToDelete = ids as string[];
    const results = {
      success: [] as string[],
      failed: [] as string[],
      totalMessagesDeleted: 0,
    };

    for (const chatId of idsToDelete) {
      try {
        const chat = await getUserChatById(chatId, userId);
        if (!chat) {
          results.failed.push(chatId);
          continue;
        }

        const messageCount = chat.messages?.length || 0;

        await deleteChat(chatId);
        results.success.push(chatId);
        results.totalMessagesDeleted += messageCount;

        logger.debug(`用户 ${userId} 删除了聊天 ${chatId}，级联删除了 ${messageCount} 条消息及其关联数据`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        logger.error(`删除聊天 ${chatId} 失败: ${errorMessage}`);
        results.failed.push(chatId);
      }
    }

    return successResponse(
      {
        results,
        totalSuccess: results.success.length,
        totalFailed: results.failed.length,
        totalMessagesDeleted: results.totalMessagesDeleted,
      },
      '删除聊天成功',
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`删除聊天失败: ${errorMessage}`);
    return errorResponse(500, '删除聊天失败');
  }
}
