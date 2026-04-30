import { memo, useCallback, useEffect, useRef } from 'react';
import { useChatHistory } from '~/.client/persistence';
import type { EditorPatch } from '~/.client/stores/pages';
import { isValidContent } from '~/.client/utils/html-parse';
import { logger } from '~/.client/utils/logger';
import { throttleWithTrailing } from '~/.client/utils/throttle';
import type { Section } from '~/types/actions';
import type { DocumentProperties, Editor } from '~/types/editor';
import { EditorComponent } from './EditorComponent';

export interface ScrollPosition {
  top: number;
  left: number;
}

export interface EditorUpdate {
  content: string;
}

export type OnChangeCallback = (editor: Editor, pageName: string, html: string) => void;
export type OnSaveCallback = () => void;
export type OnLoadCallback = (editor: Editor) => void;
export type OnReadyCallback = (editor: Editor) => void;

interface Props {
  documents?: Record<string, DocumentProperties>;
  currentPage?: string;
  currentSection?: Section;
  currentPatch?: EditorPatch;
  editable?: boolean;
  debounceChange?: number;
  debounceScroll?: number;
  onChange?: OnChangeCallback;
  onReset?: () => void;
  onSave?: OnSaveCallback;
  onLoad?: OnLoadCallback;
  onReady?: OnReadyCallback;
  onPatchApplied?: (patchId: string) => void;
  className?: string;
  settings?: any;
}

export const EditorStudio = memo(
  ({
    documents,
    currentPage,
    currentSection,
    currentPatch,
    onChange,
    onSave,
    onLoad,
    onReady,
    onPatchApplied,
  }: Props) => {
    const editorRef = useRef<Editor | null>(null);

    const pendingPatchRef = useRef<EditorPatch | null>(null);
    const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
    const chatHistory = useChatHistory();
    const onPatchAppliedRef = useRef(onPatchApplied);

    useEffect(() => {
      onPatchAppliedRef.current = onPatchApplied;
    }, [onPatchApplied]);

    const updateComponents = useCallback((editor: Editor, patch: EditorPatch) => {
      const section = patch.action;
      if (!editor) {
        logger.warn('编辑器实例不存在，无法更新组件');
        return;
      }

      if (!section.domId) {
        logger.warn('节点ID不存在，无法更新组件');
        return;
      }

      const { domId, action, content, sort, rootDomId } = section;
      // 验证 content 是否有效
      if (action !== 'remove' && !isValidContent(content)) {
        logger.warn('内容无效，无法更新组件', JSON.stringify({ action, domId }));
        return;
      }
      if (rootDomId) {
        editor.scrollToElement(`#${rootDomId}`);
      }
      const id = `#${domId}`;
      try {
        switch (action) {
          case 'add':
            editor.appendContent(id, content, sort);
            break;
          case 'update': {
            editor.updateContent(id, content, sort);
            break;
          }
          case 'remove': {
            editor.deleteContent(id);
            break;
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        logger.error(`执行组件操作时出错: `, JSON.stringify({ errorMessage, action, domId }));
      }
      if (lastPatchRef.current?.id === patch.id) {
        lastPatchRef.current = undefined;
      }
      if (pendingPatchRef.current?.id === patch.id) {
        pendingPatchRef.current = null;
      }
      onPatchAppliedRef.current?.(patch.id);
    }, []);

    const throttledSetComponents = useCallback(updateComponents, []);

    const lastPatchRef = useRef<EditorPatch | undefined>(undefined);
    const throttledSetComponentsRef = useRef(throttleWithTrailing(throttledSetComponents, 150));

    function flushPendingUpdate(editor: Editor) {
      const lastPatch = lastPatchRef.current;
      if (lastPatch) {
        updateComponents(editor, lastPatch);
        lastPatchRef.current = undefined;
      }
    }

    function setEditorDocument(editor: Editor, patch?: EditorPatch) {
      if (!patch) {
        return;
      }
      /*
       * 使用节流函数来更新组件内容
       * 这样可以避免频繁的更新导致编辑器卡顿
       */
      lastPatchRef.current = patch;
      throttledSetComponentsRef.current(editor, patch);
    }

    useEffect(() => {
      const editor = editorRef.current;

      if (!editor) {
        return;
      }

      const patch = currentPatch;
      const section = patch?.action;
      if (!section) {
        return;
      }

      if (!section.pageName) {
        logger.warn('页面名称不能为空');
      }

      // section变更时，先执行上一个section的待处理更新
      flushPendingUpdate(editor);

      // 保存最新的页面属性，确保在节流期间如果有新的更新进来，会使用最新的数据
      pendingPatchRef.current = patch;
      setEditorDocument(editor, patch);
    }, [currentPatch]);

    // 确保在组件卸载前应用最后一次更新
    useEffect(() => {
      return () => {
        const editor = editorRef.current;
        const pendingPatch = pendingPatchRef.current ?? lastPatchRef.current;

        // 清除保存定时器
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }

        if (editor && pendingPatch) {
          // 直接应用最后的更新，不通过节流
          updateComponents(editor, pendingPatch);
        }
      };
    }, []);

    const handleEditorReady = useCallback(
      async (editor: Editor) => {
        editorRef.current = editor ?? null;
        if (onReady) {
          onReady(editor);
        }
      },
      [onSave],
    );

    const handleSave = useCallback(async () => {
      const editor = editorRef.current;
      if (!editor) {
        return;
      }
      if (onSave) {
        onSave();
      }
    }, []);

    const handleContentChange = useCallback((pageName: string, html: string) => {
      if (editorRef.current && onChange) {
        onChange(editorRef.current, pageName, html);
      }
    }, []);

    const handleLoad = useCallback(async () => {
      if (editorRef.current && onLoad) {
        onLoad(editorRef.current);
      }
    }, [chatHistory]);

    return (
      <EditorComponent
        currentPage={currentPage}
        documents={documents}
        onLoad={handleLoad}
        onReady={handleEditorReady}
        onSave={handleSave}
        onContentChange={handleContentChange}
      />
    );
  },
);
