import type { Route } from '.react-router/types/app/routes/+types/chat';
import { useCallback } from 'react';
import { useRouteLoaderData, useSearchParams } from 'react-router';
import type { Section } from '~/types/actions';
import type { PageAssetData, PageData } from '~/types/pages';
import { useEditorStorage } from '../persistence/editor';

export interface ProjectData {
  pages?: PageData[];
  sections?: Section[];
  assets?: PageAssetData[];
  projectData?: any;
}

export function useChatHistory() {
  const routeData = useRouteLoaderData<Route.ComponentProps['loaderData']>('chat');
  if (!routeData) {
    return;
  }
  const { chat } = routeData;
  const { loadEditorProject, loadEditorProjectByMessageId } = useEditorStorage();
  const [searchParams] = useSearchParams();

  const getProjectByMessageId = useCallback(
    async (messageId?: string): Promise<ProjectData | undefined> => {
      if (!chat) {
        return;
      }

      const localProjectData = await loadEditorProjectByMessageId(messageId);
      if (localProjectData?.pages || localProjectData?.sections) {
        return {
          pages: localProjectData.pages,
          sections: localProjectData.sections,
          assets: localProjectData.assets,
          projectData: localProjectData.project,
        };
      }

      if (!messageId) {
        const lastMessage = chat.messages[chat.messages.length - 1];
        if (!lastMessage) {
          return;
        }

        return {
          pages: lastMessage.pagesV2 as unknown as PageData[],
          sections: normalizeSections(lastMessage.sections),
        };
      }

      const message = chat.messages.find((item) => item.id === messageId);
      if (!message) {
        return;
      }

      return {
        pages: message.pagesV2 as unknown as PageData[],
        sections: normalizeSections(message.sections),
      };
    },
    [chat, loadEditorProjectByMessageId],
  );

  /**
   * 加载项目数据。
   * 默认优先读取本地缓存；但在 rewind 场景下，服务端历史消息才是当前会话的权威来源。
   *
   * @returns 项目数据。
   */
  const getLoadProject = useCallback(async (): Promise<ProjectData | undefined> => {
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
      return await getProjectByMessageId(currentMessageId);
    }

    const projectData = await loadEditorProject();
    if (projectData) {
      return {
        pages: projectData.pages,
        sections: projectData.sections,
      };
    }

    // 没有指定消息 ID，返回最新的项目数据
    return await getProjectByMessageId();
  }, [chat, getProjectByMessageId, loadEditorProject, searchParams]);

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
    getProjectByMessageId,
  };
}

function normalizeSections(sections: unknown): Section[] {
  if (!Array.isArray(sections)) {
    return [];
  }

  return sections.flatMap((section) => {
    if (!section || typeof section !== 'object') {
      return [];
    }

    const candidate = section as Record<string, unknown>;
    const action = candidate.action;

    if (action !== 'add' && action !== 'update' && action !== 'remove') {
      return [];
    }

    return [
      {
        id: String(candidate.actionId || candidate.id || ''),
        action,
        pageName: String(candidate.pageName || ''),
        content: String(candidate.content || ''),
        domId: String(candidate.domId || ''),
        rootDomId: String(candidate.rootDomId || candidate.domId || ''),
        sort: typeof candidate.sort === 'number' ? candidate.sort : undefined,
      },
    ];
  });
}
