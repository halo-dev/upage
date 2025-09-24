import { useFetcher, useNavigate } from '@remix-run/react';
import { useCallback } from 'react';
import { toast } from 'sonner';
import {
  deleteEditorProject,
  duplicateEditorProject,
  forkEditorProject,
  openEditorDatabase,
} from '../persistence/editor';
import { getChatId } from '../stores/ai-state';
import { useProject } from './useProject';

export const editorDb = await openEditorDatabase();

export function useChatOperate() {
  const navigate = useNavigate();
  const deleteChatFetcher = useFetcher();
  const updateChatFetcher = useFetcher();

  const { forkChat: forkRemoteChat } = useProject();
  /**
   * 聊天分叉功能
   *
   * @param chatId 要复制的聊天ID
   * @param messageId 消息ID，指定复制到哪条消息为止
   * @returns 新聊天的ID
   */
  const forkMessage = async (chatId: string, messageId: string) => {
    if (!chatId) {
      return;
    }
    // 后端 fork 聊天信息，并返回新的聊天 ID
    const newId = await forkRemoteChat(chatId, messageId);

    // 前端 fork editor 项目信息
    if (newId && editorDb) {
      await forkEditorProject(editorDb, chatId, messageId, newId);
    }

    return newId;
  };

  /**
   * 根据 ID 复制聊天
   *
   * @param listItemId 聊天 ID，如果不提供则复制当前聊天
   * @returns
   */
  const duplicateCurrentChat = async (chatId?: string) => {
    if (!chatId && !getChatId()) {
      return;
    }
    const duplicateChatId = (chatId || getChatId()) as string;
    try {
      const newId = await forkRemoteChat(duplicateChatId);
      if (newId && editorDb) {
        await duplicateEditorProject(editorDb, duplicateChatId, newId);
      }
      navigate(`/chat/${newId}`, { replace: true });
      toast.success('聊天复制成功');
    } catch (error) {
      toast.error('复制聊天失败');
      console.log(error);
    }
  };

  /**
   * 根据聊天 ID 删除聊天
   * @param chatId 聊天 ID
   * @returns
   */
  const deleteChat = async (chatId: string): Promise<void> => {
    try {
      // 尝试通过API删除
      deleteChatFetcher.submit({ chatId }, { method: 'POST', action: '/api/chat/delete' });

      // 同时从本地删除
      if (editorDb) {
        await deleteEditorProject(editorDb, chatId);
      }

      console.log('Successfully deleted chat:', chatId);
      return Promise.resolve();
    } catch (error) {
      console.error('Failed to delete chat:', error);
      throw error;
    }
  };

  /**
   * 根据选择的聊天 ID 批量删除聊天
   * @param itemsToDeleteIds 要删除的聊天 ID 列表
   * @returns
   */
  const deleteSelectedItems = async (chatIds: string[]) => {
    if (chatIds.length === 0) {
      console.log('跳过批量删除: 没有要删除的聊天');
      return;
    }

    console.log(`开始批量删除 ${chatIds.length} 个聊天`, chatIds);

    // 通过 API 删除多个聊天
    deleteChatFetcher.submit({ ids: JSON.stringify(chatIds) }, { method: 'POST', action: '/api/chat/delete' });

    // 同时从本地删除
    if (editorDb) {
      let deletedCount = 0;
      const errors: string[] = [];

      for (const id of chatIds) {
        try {
          await deleteEditorProject(editorDb, id);

          deletedCount++;
        } catch (error) {
          console.error(`Error deleting local chat ${id}:`, error);
          errors.push(id);
        }
      }

      // 日志本地删除结果
      if (errors.length === 0) {
        console.log(`Local deletion: ${deletedCount} chats deleted successfully`);
      } else {
        console.warn(`Local deletion: ${deletedCount} chats deleted. ${errors.length} failed.`);
      }
    }
  };

  /**
   * 通过API更新聊天描述
   * @param chatId 待更新的聊天 ID
   * @param description 更新后的描述
   * @returns
   */
  const updateDescriptionViaApi = useCallback(
    async (chatId: string, description: string): Promise<boolean> => {
      try {
        // 使用表单格式提交数据
        updateChatFetcher.submit(
          {
            id: chatId,
            description: description,
          },
          {
            method: 'POST',
            action: '/api/chat/update',
          },
        );
        return true;
      } catch (error) {
        console.error('Failed to update description via API:', error);
        return false;
      }
    },
    [updateChatFetcher],
  );

  /**
   * 更新 Chat 描述
   * @param chatId 待更新的聊天 ID
   * @param description 更新后的描述
   */
  const updateChatDescription = async (description: string, chatId?: string) => {
    const id = chatId || getChatId();
    if (!id) {
      return;
    }
    try {
      await updateDescriptionViaApi(id, description);
    } catch (error) {
      toast.error('更新聊天描述失败: ' + (error as Error).message);
    }
  };

  return {
    updateChatFetcher,
    deleteChatFetcher,
    deleteChat,
    deleteSelectedItems,
    forkMessage,
    duplicateCurrentChat,
    updateChatDescription,
  };
}
