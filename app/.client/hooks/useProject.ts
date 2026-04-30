import { toast } from 'sonner';
import { createScopedLogger } from '~/.client/utils/logger';
import type { ApiResponse } from '~/types/global';
import type { PageSection } from '~/types/pages';
import { useEditorStorage } from '../persistence/editor';
import { getChatId } from '../stores/ai-state';
import { webBuilderStore } from '../stores/web-builder';

const logger = createScopedLogger('useGrapesProject');
const MESSAGE_NOT_READY_ERROR = '当前消息尚未保存，无法保存项目，请等待响应完成后重试';
const SAVE_PROJECT_RETRY_DELAY_MS = 500;
const SAVE_PROJECT_MAX_RETRIES = 3;
type FetchLike = typeof fetch;
type SaveProjectPayload = {
  messageId: string;
  pages: string;
  sections: string;
};

type StoredPage = NonNullable<ReturnType<typeof webBuilderStore.pagesStore.pages.get>[string]>;

function hasValidPageName(page: StoredPage | undefined): page is StoredPage {
  return page !== undefined && typeof page.name === 'string' && page.name.trim().length > 0;
}

function hasValidSectionPageName(section: PageSection | undefined): section is PageSection {
  return section !== undefined && typeof section.pageName === 'string' && section.pageName.trim().length > 0;
}

export function useProject() {
  const { saveEditorProject } = useEditorStorage();

  /**
   * Save project data
   *
   * @param messageId message ID
   * @param projectData WebBuilder project data
   * @param sections page section data
   * @returns whether the project is saved successfully
   */
  async function saveProject(messageId: string) {
    if (!messageId) {
      logger.error('保存项目失败: 消息ID不能为空');
      return false;
    }

    await webBuilderStore.chatStore.waitForAllActionsSettled();

    // before saving, save all pages
    await webBuilderStore.saveAllPages('auto-save');
    const projectPages = Object.values(webBuilderStore.pagesStore.pages.get()).filter(hasValidPageName);
    const projectSections = Object.values(webBuilderStore.pagesStore.sections.get())
      .filter(hasValidSectionPageName)
      .map((section) => ({
        ...section,
        actionId: section.id,
      }));
    if (projectPages.length === 0 || projectSections.length === 0) {
      logger.error('保存项目失败: 页面或 Section 不能为空');
      return false;
    }
    const isConsistent = projectPages.every((page) => {
      const actionIds = page.actionIds;
      const content = page.content;
      if (actionIds.length === 0) {
        return true;
      }
      if (!content) {
        return false;
      }
      return true;
    });
    if (!isConsistent) {
      logger.error(
        '保存项目失败: 页面内容与 actions 不一致',
        JSON.stringify({
          projectPages,
          projectSections,
        }),
      );
      return false;
    }
    const projectPageV2 = projectPages.map((page) => ({ ...page, messageId }));
    try {
      // 先保存在本地数据中
      saveEditorProject(messageId, projectPageV2, projectSections);
      const result = await saveProjectToServer({
        messageId,
        pages: JSON.stringify(projectPageV2),
        sections: JSON.stringify(projectSections),
      });

      if (!result.success) {
        toast.error(`保存项目失败: ${result.message}`);
        logger.error(`保存项目失败: ${result.message}`);
        return false;
      }
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      toast.error(`保存项目失败: ${errorMessage}`);
      logger.error(`保存项目失败: ${errorMessage}`);
      return false;
    }
  }

  /**
   * 复制聊天及其相关内容（消息、GrapesJS项目数据和区块）
   *
   * @param chatId 要复制的聊天ID
   * @param messageId 可选参数，当提供时只复制到该消息为止的消息（包含该消息）；不提供时复制整个聊天
   * @returns 成功时返回新聊天的ID，失败时返回undefined
   */
  async function forkChat(chatId: string, messageId?: string) {
    if (!chatId) {
      logger.error('复制聊天失败: 聊天ID不能为空');
      return undefined;
    }

    try {
      const currentMessageId = webBuilderStore.chatStore.currentMessageId.get();
      if (!messageId && currentMessageId && getChatId() === chatId) {
        await saveProject(currentMessageId);
      }

      // 调用后端API复制聊天
      const response = await fetch('/api/chat/fork', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceChatId: chatId,
          messageId,
        }),
      });

      const { data, success, message } = (await response.json()) as ApiResponse<string>;

      if (!response.ok || !success) {
        logger.error('复制聊天失败:', message);
        return undefined;
      }

      logger.info(`成功复制聊天 ${chatId}，新聊天ID: ${data}`);
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logger.error(`复制聊天过程中发生错误: ${errorMessage}`);
      return undefined;
    }
  }

  return {
    saveProject,
    forkChat,
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export async function saveProjectToServer(
  payload: SaveProjectPayload,
  fetchImplementation: FetchLike = fetch,
): Promise<ApiResponse<string>> {
  for (let attempt = 1; attempt <= SAVE_PROJECT_MAX_RETRIES; attempt++) {
    const formData = new FormData();
    formData.append('messageId', payload.messageId);
    formData.append('pages', payload.pages);
    formData.append('sections', payload.sections);

    const response = await fetchImplementation('/api/project', {
      method: 'POST',
      body: formData,
    });
    const result = (await response.json()) as ApiResponse<string>;

    if (response.ok && result.success) {
      return result;
    }

    const canRetry = result.message === MESSAGE_NOT_READY_ERROR && attempt < SAVE_PROJECT_MAX_RETRIES;
    if (canRetry) {
      await sleep(SAVE_PROJECT_RETRY_DELAY_MS * attempt);
      continue;
    }

    return result;
  }

  return {
    success: false,
    message: '项目保存失败',
  } as ApiResponse<string>;
}
