import { useFetcher } from '@remix-run/react';
import { useCallback, useEffect, useState } from 'react';
import { debounce } from '~/.client/utils/debounce';
import type { ApiResponse } from '~/types/global';

export interface ServerChatListResponse {
  chats: ServerChatItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface ServerChatItem {
  id: string;
  urlId?: string;
  description?: string;
  timestamp: string;
  lastMessage?: string;
}

export function useChatEntries() {
  const chatListFetcher = useFetcher<ApiResponse<ServerChatListResponse>>();

  const [lastFetchedQuery, setLastFetchedQuery] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [entries, setEntries] = useState<ServerChatItem[]>([]);

  /**
   * 从后端调用接口查询列表数据
   * @param query 查询条件
   * @returns
   */
  const loadServerChatEntries = useCallback(
    debounce((query = '') => {
      // 避免重复请求相同查询
      if (lastFetchedQuery === query && chatListFetcher.state === 'loading') {
        return;
      }

      setIsLoading(true);
      setLastFetchedQuery(query);

      chatListFetcher.load(`/api/chat/list?q=${encodeURIComponent(query)}`);
    }, 300),
    [chatListFetcher, lastFetchedQuery],
  );

  // 在 chatListFetcher 数据加载完成后处理结果
  useEffect(() => {
    if (chatListFetcher.state === 'idle' && chatListFetcher.data) {
      try {
        const { data } = chatListFetcher.data;
        const serverChats = data?.chats || [];
        setEntries(serverChats);
      } catch (error) {
        console.error('Error processing server chats:', error);
      } finally {
        setIsLoading(false);
      }
    }
  }, [chatListFetcher, chatListFetcher]);

  /**
   * 获取聊天列表
   * @param query 查询条件
   */
  const loadChatEntries = useCallback(
    (query = '') => {
      // 从服务端加载搜索结果（如果搜索词长度>=2或为空）
      try {
        setIsLoading(true);
        if (query.length >= 2 || query === '') {
          loadServerChatEntries(query);
        }
      } catch (error) {
        console.error('Failed to load chats from server:', error);
      }
    },
    [loadServerChatEntries],
  );

  return { entries, isLoading, loadChatEntries };
}
