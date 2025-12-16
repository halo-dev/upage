import type { LoaderFunctionArgs } from '@remix-run/node';
import { getUserChats } from '~/.server/service/chat';
import { errorResponse, successResponse } from '~/.server/utils/api-response';
import { createScopedLogger } from '~/.server/utils/logger';

const logger = createScopedLogger('api.chat.list');

export type HandleListLoaderArgs = LoaderFunctionArgs & {
  userId: string;
};

/**
 * 处理获取聊天列表操作
 */
export async function handleListLoader({ request, userId }: HandleListLoaderArgs) {
  try {
    const url = new URL(request.url);
    const searchQuery = url.searchParams.get('q') || '';
    const limit = parseInt(url.searchParams.get('limit') || '20', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    logger.debug(`获取用户 ${userId} 的聊天列表，搜索: ${searchQuery}, 限制: ${limit}, 偏移: ${offset}`);

    const { chats, total } = await getUserChats(userId, limit, offset);

    // 如果有搜索关键词，过滤结果
    let filteredChats = chats;
    if (searchQuery) {
      filteredChats = chats.filter((chat) => chat.description?.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    return successResponse(
      {
        chats: filteredChats.map((chat) => ({
          id: chat.id,
          urlId: chat.urlId,
          description: chat.description,
          timestamp: chat.updatedAt,
          lastMessage: chat.messages[0]?.content,
        })),
        total: searchQuery ? filteredChats.length : total,
        limit,
        offset,
      },
      '获取聊天列表成功',
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`获取聊天列表失败: ${errorMessage}`);
    return errorResponse(500, '获取聊天列表失败');
  }
}
