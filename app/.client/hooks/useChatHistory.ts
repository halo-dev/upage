import { useRouteLoaderData, useSearchParams } from '@remix-run/react';
import { useCallback } from 'react';
import type { Section } from '~/types/actions';
import type { ChatWithMessages } from '~/types/chat';
import type { PageAssetData, PageData } from '~/types/pages';
import { useEditorStorage } from '../persistence/editor';

export interface ProjectData {
  pages?: PageData[];
  sections?: Section[];
  assets?: PageAssetData[];
  projectData?: any;
}

export function useChatHistory() {
  const routeData = useRouteLoaderData<{ chat?: ChatWithMessages }>('routes/_layout.chat.$id');
  if (!routeData) {
    return;
  }
  const { chat } = routeData;
  const { loadEditorProject } = useEditorStorage();
  const [searchParams] = useSearchParams();

  /**
   * 加载项目数据，先从本地缓存中加载，如果本地缓存没有数据，则从服务器加载。
   *
   * @returns 项目数据。
   */
  const getLoadProject = useCallback(async (): Promise<ProjectData | undefined> => {
    const projectData = await loadEditorProject();
    if (projectData) {
      return {
        pages: projectData.pages,
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
      const pages = data?.pagesV2 as unknown as PageData[];
      if (pages) {
        return {
          pages,
        };
      }
    }
    // 没有指定消息 ID，返回最新的项目数据
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.pagesV2) {
      return {
        pages: lastMessage.pagesV2 as unknown as PageData[],
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
