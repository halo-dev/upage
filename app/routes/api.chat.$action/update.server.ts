import type { ActionFunctionArgs } from '@remix-run/node';
import { getUserChatById, updateChat } from '~/lib/.server/chat';
import { errorResponse, successResponse } from '~/utils/api-response';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.chat.update');

export type HandleUpdateActionArgs = ActionFunctionArgs & {
  userId: string;
};

/**
 * 处理更新聊天操作
 */
export async function handleUpdateAction({ request, userId }: HandleUpdateActionArgs) {
  // 只接受POST请求
  if (request.method !== 'POST') {
    return errorResponse(405, '请求方法不支持');
  }

  try {
    const formData = await request.formData();
    const id = formData.get('id') as string;
    const description = formData.get('description') as string;

    logger.debug(`处理聊天更新请求，ID: ${id}, 描述: ${description}`);

    if (!id) {
      return errorResponse(400, '缺少聊天ID');
    }

    if (!description || description.trim() === '') {
      return errorResponse(400, '描述不能为空');
    }

    // 验证聊天记录是否属于当前用户
    const chat = await getUserChatById(id, userId);
    if (!chat) {
      return errorResponse(404, '未找到聊天记录或无权限操作');
    }

    // 更新描述
    const updatedChat = await updateChat(id, { description });

    logger.debug(`用户 ${userId} 更新了聊天 ${id} 的描述`);

    return successResponse(
      {
        chat: {
          id: updatedChat.id,
          description: updatedChat.description,
          timestamp: updatedChat.updatedAt,
        },
      },
      '更新聊天描述成功',
    );
  } catch (error) {
    logger.error('更新聊天描述失败', error);
    return errorResponse(500, '更新聊天描述失败');
  }
}
