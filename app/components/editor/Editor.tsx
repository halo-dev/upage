import { memo, useCallback, useEffect, useRef } from 'react';
import { useChatHistory } from '~/lib/persistence';
import type { Section } from '~/types/actions';
import type { DocumentProperties, Editor } from '~/types/editor';
import { isValidContent } from '~/utils/html-parse';
import { logger } from '~/utils/logger';
import { throttleWithTrailing } from '~/utils/throttle';
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
  editable?: boolean;
  debounceChange?: number;
  debounceScroll?: number;
  autoFocusOnDocumentChange?: boolean;
  onChange?: OnChangeCallback;
  onReset?: () => void;
  onSave?: OnSaveCallback;
  onLoad?: OnLoadCallback;
  onReady?: OnReadyCallback;
  className?: string;
  settings?: any;
}

export const EditorStudio = memo(
  ({ documents, currentPage, currentSection, autoFocusOnDocumentChange, onChange, onSave, onLoad, onReady }: Props) => {
    const editorRef = useRef<Editor | null>(null);

    const pendingSectionRef = useRef<Section | null>(null);
    const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
    const { getLoadProject } = useChatHistory();

    const updateComponents = useCallback((editor: Editor, section: Section) => {
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
        logger.error('执行组件操作时出错', JSON.stringify({ error, action, domId }));
      }
    }, []);

    const throttledSetComponents = useCallback(updateComponents, []);

    const lastSectionRef = useRef<Section | undefined>(undefined);
    const throttledSetComponentsRef = useRef(throttleWithTrailing(throttledSetComponents, 150));

    function flushPendingUpdate(editor: Editor) {
      const lastSection = lastSectionRef.current;
      if (lastSection && lastSection.content) {
        updateComponents(editor, lastSection);
        lastSectionRef.current = undefined;
      }
    }

    function setEditorDocument(editor: Editor, section?: Section) {
      if (!section) {
        return;
      }
      /*
       * 使用节流函数来更新组件内容
       * 这样可以避免频繁的更新导致编辑器卡顿
       */
      if (section) {
        lastSectionRef.current = section;
        throttledSetComponentsRef.current(editor, section);
      }
    }

    useEffect(() => {
      const editor = editorRef.current;

      if (!editor) {
        return;
      }

      if (!currentSection) {
        return;
      }

      if (!currentSection.pageName) {
        logger.warn('page should not be empty');
      }

      // section变更时，先执行上一个section的待处理更新
      flushPendingUpdate(editor);

      // 保存最新的页面属性，确保在节流期间如果有新的更新进来，会使用最新的数据
      pendingSectionRef.current = currentSection;
      setEditorDocument(editor, currentSection);
    }, [currentSection, autoFocusOnDocumentChange]);

    // 确保在组件卸载前应用最后一次更新
    useEffect(() => {
      return () => {
        const editor = editorRef.current;
        const pendingSection = pendingSectionRef.current;

        // 清除保存定时器
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }

        if (editor && pendingSection && pendingSection) {
          // 直接应用最后的更新，不通过节流
          updateComponents(editor, pendingSection);
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

    const handleAutoSave = useCallback(async () => {
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
    }, [getLoadProject]);

    return (
      <EditorComponent
        currentPage={currentPage}
        documents={documents}
        onLoad={handleLoad}
        onReady={handleEditorReady}
        onSave={handleAutoSave}
        onContentChange={handleContentChange}
      />
    );
  },
);
