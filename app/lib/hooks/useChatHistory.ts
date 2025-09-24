import { useLoaderData, useSearchParams } from '@remix-run/react';
import { useCallback } from 'react';
import type { Page, Section } from '~/types/actions';
import type { ChatWithMessages } from '~/types/chat';
import { useEditorStorage } from '../persistence/editor';

export interface ProjectData {
  pages?: Page[];
  sections?: Section[];
  projectData?: any;
}

export function useChatHistory() {
  const { chat } = useLoaderData<{ chat?: ChatWithMessages }>();
  const { loadEditorProject } = useEditorStorage();
  const [searchParams] = useSearchParams();

  /**
   * 加载项目数据，先从本地缓存中加载，如果本地缓存没有数据，则从服务器加载。
   *
   * @returns 项目数据。
   */
  const getLoadProject = useCallback(async (): Promise<ProjectData | undefined> => {
    // 加载最新数据
    const pages = await loadEditorProject();
    if (pages) {
      return {
        pages,
      };
    }
    if (!chat) {
      return;
    }

    const { messages } = chat;
    if (!messages || messages.length === 0) {
      return;
    }

    // 返回特定消息 ID 的项目数据
    const currentMessageId = searchParams.get('rewindTo');
    if (currentMessageId) {
      const data = messages?.find((message) => message.id === currentMessageId);
      const pages = data?.page?.pages;
      if (pages) {
        return {
          pages: pages as unknown as Page[],
        };
      }
    }
    // 没有指定消息 ID，返回最新的项目数据
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.page) {
      return {
        pages: lastMessage.page.pages as unknown as Page[],
      };
    }
  }, [chat, searchParams]);

  /**
   * 获取聊天最新描述
   * @param chatId
   * @returns
   */
  const getChatLatestDescription = useCallback(() => {
    if (!chat) {
      return '';
    }
    return chat.description || '';
  }, [chat]);
  return {
    getLoadProject,
    getChatLatestDescription,
  };
}
