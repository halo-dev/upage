import type { LoaderFunctionArgs } from 'react-router';
import { requireAuth } from '~/.server/service/auth';
import { getUserChats } from '~/.server/service/chat';
import { errorResponse, successResponse } from '~/.server/utils/api-response';
import { createScopedLogger } from '~/.server/utils/logger';

const logger = createScopedLogger('api.chat.list');

export async function loader({ request }: LoaderFunctionArgs) {
  const authResult = await requireAuth(request, { isApi: true });
  if (authResult instanceof Response) {
    return authResult;
  }

  const userId = authResult.userInfo?.sub;
  if (!userId) {
    return errorResponse(401, '用户未登录');
  }

  return handleListLoader({ request, userId });
}

/**
 * 处理获取聊天列表操作
 */
async function handleListLoader({ request, userId }: { request: Request; userId: string }) {
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
