import type { RefObject } from 'react';
import { createRef, useCallback, useEffect, useRef } from 'react';
import { useEditorCommands } from '~/.client/hooks';
import type { DocumentProperties, Editor } from '~/types/editor';
import { EditorController } from './EditorController';
import { EditorRender } from './EditorRender';
import { PageRender, type PageRenderRef } from './PageRender';

export interface EditorComponentProps {
  documents?: Record<string, DocumentProperties>;
  currentPage?: string;
  onReady?: (editor: Editor) => void;
  onLoad?: () => Promise<void>;
  onContentChange?: (pageName: string, html: string) => void;
  onSave?: (pageName: string, html: string) => Promise<void> | void;
}

export function EditorComponent(props: EditorComponentProps) {
  const { documents = {}, currentPage, onReady, onLoad, onContentChange, onSave } = props;

  const controllerRef = useRef<EditorController | null>(null);
  const lastContentRef = useRef<Record<string, string>>({});
  const pageRefsRef = useRef<Record<string, RefObject<PageRenderRef | null>>>({});
  const currentPageRef = useRef<string | undefined>(currentPage);

  useEditorCommands(controllerRef);

  useEffect(() => {
    Object.keys(documents).forEach((docName) => {
      if (!pageRefsRef.current[docName]) {
        pageRefsRef.current[docName] = createRef<PageRenderRef>();
      }
    });
  }, [documents]);

  useEffect(() => {
    if (!controllerRef.current) {
      controllerRef.current = new EditorController({
        getContentElement,
        getIframeElement,
      });

      setTimeout(() => {
        if (controllerRef.current && onReady) {
          onReady(controllerRef.current);
        }
      }, 0);
    }
  }, [onReady]);

  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  const getContentElement = useCallback((): HTMLElement | null => {
    const currentPageName = currentPageRef.current ?? 'index';
    return pageRefsRef.current[currentPageName]?.current?.element ?? null;
  }, [pageRefsRef]);

  const getIframeElement = useCallback((): HTMLIFrameElement | null => {
    const currentPageName = currentPageRef.current ?? 'index';
    return pageRefsRef.current[currentPageName]?.current?.iframe ?? null;
  }, [pageRefsRef]);

  /**
   * 执行保存
   * @param html 要保存的 HTML 内容
   */
  const handleSave = useCallback(
    (pageName: string, html: string): void => {
      if (lastContentRef.current[pageName] === html) {
        return;
      }

      lastContentRef.current[pageName] = html;
      if (onSave) {
        onSave(pageName, html);
      }
    },
    [onSave],
  );

  const handleContentUpdate = useCallback(
    (pageName: string, html: string): void => {
      if (lastContentRef.current[pageName] === html) {
        return;
      }

      if (onContentChange) {
        onContentChange(pageName, html);
      }
    },
    [onContentChange],
  );

  const handleMount = useCallback(async (): Promise<void> => {
    if (onLoad) {
      await onLoad();
    }
  }, [onLoad]);

  return (
    <EditorRender onMount={handleMount}>
      {Object.values(documents).map((document) => (
        <PageRender
          isCurrentPage={document.name === currentPage}
          ref={pageRefsRef.current[document.name]}
          key={document.name}
          document={document}
          onUpdate={handleContentUpdate}
          onSave={handleSave}
        />
      ))}
    </EditorRender>
  );
}
