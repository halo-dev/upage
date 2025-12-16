import { type RefObject, useCallback, useEffect } from 'react';
import { editorCommands } from '~/.client/stores/editor';
import { logger } from '~/.client/utils/logger';
import type { Editor } from '~/types/editor';

/**
 * 用于监听编辑器命令的自定义 hook
 * @param editorRef 编辑器实例引用
 * @returns 包含处理特定元素的方法
 */
export function useEditorCommands(editorRef: RefObject<Editor | null>) {
  // 处理滚动到指定元素
  const scrollToElement = useCallback(
    (domId: string) => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }
      editor.scrollToElement(`#${domId}`);
    },
    [editorRef],
  );

  // 监听编辑器命令
  useEffect(() => {
    const unsubscribe = editorCommands.listen((command) => {
      if (!command) {
        return;
      }

      switch (command.type) {
        case 'scrollToElement': {
          const { domId } = command.payload;
          scrollToElement(domId);
          break;
        }
        default:
          logger.warn('未知的编辑器命令类型', command);
      }

      // 处理完命令后重置
      editorCommands.set(null);
    });

    return () => {
      unsubscribe();
    };
  }, [scrollToElement]);

  return {
    scrollToElement,
  };
}
