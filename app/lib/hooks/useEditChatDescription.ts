import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useChatOperate } from './useChatOperate';

interface EditChatDescriptionOptions {
  initialDescription: string;
  chatId?: string;
}

type EditChatDescriptionHook = {
  editing: boolean;
  setCurrentDescription: (description: string) => void;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleBlur: () => Promise<void>;
  handleSubmit: (event: React.FormEvent) => Promise<void>;
  handleKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => Promise<void>;
  currentDescription: string | undefined;
  toggleEditMode: () => void;
  updateChatDescription: (description: string, chatId?: string) => Promise<void>;
};

/**
 * Hook to manage the state and behavior for editing chat descriptions.
 *
 * Offers functions to:
 * - Switch between edit and view modes.
 * - Manage input changes, blur, and form submission events.
 * - Save updates to backend API, fallback to IndexedDB and optionally to the global application state.
 *
 * @param {Object} options
 * @param {string} options.initialDescription - The current chat description.
 * @param {string} options.customChatId - Optional ID for updating the description via the sidebar.
 * @returns {EditChatDescriptionHook} Methods and state for managing description edits.
 */
export function useEditChatDescription({
  initialDescription,
  chatId,
}: EditChatDescriptionOptions): EditChatDescriptionHook {
  const { updateChatDescription } = useChatOperate();
  // 从 messages 中获取到的描述
  const [editing, setEditing] = useState(false);
  const [currentDescription, setCurrentDescription] = useState(initialDescription);

  const toggleEditMode = useCallback(() => setEditing((prev) => !prev), []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentDescription(e.target.value);
  }, []);

  const handleBlur = useCallback(async () => {
    setCurrentDescription(initialDescription);
    toggleEditMode();
  }, [toggleEditMode]);

  const isValidDescription = useCallback(
    (desc: string): boolean => {
      const trimmedDesc = desc.trim();

      if (trimmedDesc === initialDescription) {
        toggleEditMode();
        return false; // No change, skip validation
      }

      const lengthValid = trimmedDesc.length > 0 && trimmedDesc.length <= 100;

      // 允许中文字符、字母、数字、空格和常见标点符号，排除可能引起问题的字符
      const characterValid = /^[\u4e00-\u9fa5a-zA-Z0-9\s\-_.,!?()[\]{}'"]+$/.test(trimmedDesc);

      if (!lengthValid) {
        toast.error('描述必须介于 1 和 100 个字符之间。');
        return false;
      }

      if (!characterValid) {
        toast.error('描述只能包含字母、数字、空格和基本标点符号。');
        return false;
      }

      return true;
    },
    [initialDescription, toggleEditMode],
  );

  const handleSubmit = useCallback(
    async (event?: React.FormEvent) => {
      event?.preventDefault();

      if (!isValidDescription(currentDescription!)) {
        return;
      }

      try {
        if (!currentDescription) {
          return;
        }
        updateChatDescription(currentDescription!, chatId);
      } catch (error) {
        toast.error('更新聊天描述失败: ' + (error as Error).message);
      }

      toggleEditMode();
    },
    [currentDescription, chatId, toggleEditMode, updateChatDescription, isValidDescription],
  );

  const handleKeyDown = useCallback(
    async (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        await handleBlur();
      }
    },
    [handleBlur],
  );

  return {
    editing,
    setCurrentDescription,
    handleChange,
    handleBlur,
    handleSubmit,
    handleKeyDown,
    currentDescription,
    toggleEditMode,
    updateChatDescription,
  };
}
