import { useFetcher } from '@remix-run/react';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { createScopedLogger } from '~/.client/utils/logger';
import type { ApiResponse } from '~/types/global';
import { useEditorStorage } from '../persistence/editor';
import { webBuilderStore } from '../stores/web-builder';

const logger = createScopedLogger('useGrapesProject');

export function useProject() {
  const fetcher = useFetcher();
  const { saveEditorProject } = useEditorStorage();

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      const { success, message } = fetcher.data as ApiResponse<string>;
      if (!success) {
        toast.error(`保存项目失败: ${message}`);
      }
    }
  }, [fetcher]);

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

    // before saving, save all pages
    await webBuilderStore.saveAllPages('auto-save');
    const projectPages = Object.values(webBuilderStore.pagesStore.pages.get()).filter((page) => page !== undefined);
    const projectSections = Object.values(webBuilderStore.pagesStore.sections.get())
      .filter((section) => section !== undefined)
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
      // 再调用远程接口保存到后端数据库
      // 使用fetcher调用API保存项目数据
      fetcher.submit(
        {
          messageId,
          pages: JSON.stringify(projectPageV2),
          sections: JSON.stringify(projectSections),
        },
        {
          method: 'POST',
          action: '/api/project',
        },
      );
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
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
