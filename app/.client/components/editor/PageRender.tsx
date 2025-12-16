import { motion, type Variants } from 'framer-motion';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import Frame from 'react-frame-component';
import { executeScripts } from '~/.client/utils/execute-scripts';
import { isMac } from '~/.client/utils/os';
import type { DocumentProperties } from '~/types/editor';
import { EditorOverlay } from './EditorOverlay';

export interface PageRenderRef {
  element: HTMLDivElement | null;
  iframe: HTMLIFrameElement | null;
}

export interface EditorRenderProps {
  document: DocumentProperties;
  onUpdate?: (pageName: string, html: string) => void;
  onSave?: (pageName: string, html: string) => void;
  isCurrentPage?: boolean;
}

const pageAnimationVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.98,
    zIndex: 1,
  },
  visible: {
    opacity: 1,
    scale: 1,
    zIndex: 2,
    transition: {
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1],
    },
  },
  inactive: {
    opacity: 0,
    scale: 0.98,
    zIndex: 1,
    pointerEvents: 'none',
    display: 'none',
    transition: {
      duration: 0.2,
    },
  },
};

/**
 * 使用 HTML 来渲染页面。并在当前页面的 HTML 有所变化时，调用更新函数。
 * 为了保证纯净性，此函数将只考虑渲染 HTML 以及更新，与外部的所有交互无关。
 */
export const PageRender = forwardRef<PageRenderRef, EditorRenderProps>(
  ({ document, onUpdate, onSave, isCurrentPage }, ref) => {
    const frameRef = useRef<HTMLIFrameElement | null>(null);
    const contentRef = useRef<HTMLDivElement | null>(null);
    const observerRef = useRef<MutationObserver | null>(null);
    const lastContentRef = useRef<string | null>(null);
    const isMountedRef = useRef<boolean>(false);
    const documentContentRef = useRef<string>(document.content);
    const previousSelectedElementRef = useRef<HTMLElement | null>(null);
    const hasUnsavedChangesRef = useRef<boolean>(false);

    const [hoveredElement, setHoveredElement] = useState<HTMLElement | null>(null);
    const [selectedElement, setSelectedElement] = useState<HTMLElement | null>(null);
    // 解决 react-frame-component 首次加载时可能无法加载的问题。
    // https://github.com/ryanseddon/react-frame-component/issues/192
    const [show, setShow] = useState(false);
    useEffect(() => {
      setShow(true);
    }, []);

    useImperativeHandle(ref, () => {
      return {
        element: contentRef.current,
        iframe: frameRef.current,
      };
    }, [frameRef.current, contentRef.current]);

    const setElementEditable = useCallback((element: HTMLElement, isEditable: boolean) => {
      if (isEditable) {
        element.contentEditable = 'true';
        element.focus();
        return;
      }
      element.removeAttribute('contenteditable');
      element.blur();
    }, []);

    useEffect(() => {
      documentContentRef.current = document.content;
    }, [document.content]);

    const handleSave = useCallback(() => {
      if (!onSave || !hasUnsavedChangesRef.current || !frameRef.current) {
        return;
      }

      const iframeDocument = frameRef.current.contentDocument;
      if (!iframeDocument) {
        return;
      }

      const editorContent = iframeDocument.getElementById('page-content');
      if (!editorContent) {
        return;
      }

      const contentHTML = editorContent.querySelector(`#page-${document.name}`);
      if (!contentHTML) {
        return;
      }

      const currentContent = contentHTML.innerHTML;
      onSave(document.name, currentContent);
      hasUnsavedChangesRef.current = false;
    }, [onSave, document.name]);

    useEffect(() => {
      if (selectedElement) {
        setElementEditable(selectedElement, true);
      }

      if (previousSelectedElementRef.current !== selectedElement) {
        setTimeout(() => {
          handleSave();
        }, 1000);
      }

      if (previousSelectedElementRef.current) {
        setElementEditable(previousSelectedElementRef.current, false);
      }
      previousSelectedElementRef.current = selectedElement;
    }, [selectedElement, setElementEditable, handleSave]);

    const processContentUpdate = useCallback(
      (contentHTML: Element | null) => {
        if (!contentHTML) {
          return;
        }

        const currentContent = contentHTML.innerHTML;
        if (currentContent !== lastContentRef.current) {
          lastContentRef.current = currentContent;
          hasUnsavedChangesRef.current = true;
          if (onUpdate) {
            onUpdate(document.name, currentContent);
          }
        }
      },
      [onUpdate, document.name],
    );

    const setupMutationObserver = useCallback(() => {
      if (!frameRef.current) {
        return;
      }

      const iframeDocument = frameRef.current.contentDocument;
      if (!iframeDocument) {
        return;
      }

      const editorContent = iframeDocument.getElementById('page-content');
      if (!editorContent) {
        return;
      }

      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      let updateTimer: NodeJS.Timeout | null = null;

      const observer = new MutationObserver((mutations) => {
        if (mutations.length === 0) {
          return;
        }

        const hasRealChanges = mutations.some(
          (mutation) => !(mutation.type === 'attributes' && mutation.attributeName === 'contenteditable'),
        );

        if (!hasRealChanges) {
          return;
        }

        if (updateTimer) {
          clearTimeout(updateTimer);
        }

        updateTimer = setTimeout(() => {
          const contentHTML = editorContent.querySelector(`#page-${document.name}`);
          if (!contentHTML) {
            return;
          }

          const currentContent = contentHTML.innerHTML;
          if (currentContent !== lastContentRef.current) {
            processContentUpdate(contentHTML);
          }
        }, 0);
      });

      const config: MutationObserverInit = {
        attributes: true,
        childList: true,
        characterData: true,
        subtree: true,
        attributeOldValue: true,
        characterDataOldValue: true,
      };

      observer.observe(editorContent, config);
      observerRef.current = observer;

      return () => {
        if (updateTimer) {
          clearTimeout(updateTimer);
        }
        observer.disconnect();
        observerRef.current = null;
      };
    }, [processContentUpdate]);

    const handleKeyDown = useCallback(
      (e: KeyboardEvent) => {
        if ((isMac ? e.metaKey : e.ctrlKey) && e.key === 's') {
          e.preventDefault();
          handleSave();
        }
      },
      [handleSave],
    );

    useEffect(() => {
      if (isCurrentPage && frameRef.current) {
        if (frameRef.current.style.display === 'none') {
          frameRef.current.style.display = 'block';
        }
        if (frameRef.current.style.visibility === 'hidden') {
          frameRef.current.style.visibility = 'visible';
        }
        setupMutationObserver();

        // 添加键盘事件监听器
        window.addEventListener('keydown', handleKeyDown);

        // 在 iframe 内也添加键盘事件监听器
        const iframeDocument = frameRef.current.contentDocument;
        if (iframeDocument) {
          iframeDocument.addEventListener('keydown', handleKeyDown);
        }
      } else if (!isCurrentPage && observerRef.current) {
        observerRef.current.disconnect();
        if (frameRef.current) {
          frameRef.current.style.visibility = 'hidden';
          frameRef.current.style.display = 'none';
        }
      }

      return () => {
        if (observerRef.current) {
          observerRef.current.disconnect();
        }
        window.removeEventListener('keydown', handleKeyDown);

        if (frameRef.current?.contentDocument) {
          frameRef.current.contentDocument.removeEventListener('keydown', handleKeyDown);
        }
      };
    }, [isCurrentPage, setupMutationObserver, handleKeyDown]);

    const handleFrameMount = useCallback(() => {
      isMountedRef.current = true;
      if (frameRef.current) {
        if (isCurrentPage || isCurrentPage === undefined) {
          frameRef.current.style.visibility = 'visible';
          frameRef.current.style.display = 'block';
          setupMutationObserver();

          const iframeDocument = frameRef.current.contentDocument;
          if (iframeDocument) {
            iframeDocument.addEventListener('keydown', handleKeyDown);
          }
        } else {
          frameRef.current.style.visibility = 'hidden';
          frameRef.current.style.display = 'none';
        }
      }
      if (documentContentRef.current) {
        const iframeDocument = frameRef.current?.contentDocument;
        if (!iframeDocument) {
          return;
        }
        const editorContent = iframeDocument.getElementById('page-content');
        if (!editorContent) {
          return;
        }
        initialPageContent();
      }
      // 如果 document 的 content 不为空，则设置为初始内容。
    }, [isCurrentPage, setupMutationObserver, handleKeyDown]);

    const initialPageContent = useCallback(() => {
      if (!contentRef.current) {
        return;
      }

      hasUnsavedChangesRef.current = false;
      lastContentRef.current = documentContentRef.current;
      contentRef.current.innerHTML = documentContentRef.current;
      executeScripts(contentRef.current);
      const event = new Event('DOMContentLoaded', {
        bubbles: true,
        cancelable: true,
      });
      frameRef.current?.contentDocument?.dispatchEvent(event);
    }, [ref, documentContentRef]);

    // 初始化的 HTML 内容，如果有 HTML 所需的一些外部资源，可以在这里添加。但需要注意的是，导出时，需要将这些资源也导出。
    const initialContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <script src="${import.meta.env.BASE_URL}tailwindcss.js"></script>
            <script src="${import.meta.env.BASE_URL}iconify-icon.min.js"></script>
            ${document.head}

            <style>
              html, body {
                height: 100%;
                width: 100%;
                margin: 0;
                padding: 0;
                overflow: hidden;
              }
              #page-content {
                height: 100%;
                width: 100%;
                margin: 0;
                padding: 0;
                display: block;
                overflow-y: auto;
              }
            </style>
          </head>
          <body>
            <div id="page-content"></div>
          </body>
        </html>
      `;

    return (
      <motion.div
        className="page-render w-full h-full absolute"
        initial="hidden"
        animate={isCurrentPage ? 'visible' : 'inactive'}
        variants={pageAnimationVariants}
        key={document.name}
        style={{
          width: '100%',
          height: '100%',
          top: 0,
          left: 0,
          margin: 0,
          padding: 0,
          overflow: 'hidden',
          display: isCurrentPage ? 'block' : 'none',
          position: 'absolute',
        }}
      >
        {show && (
          <Frame
            ref={frameRef}
            initialContent={initialContent}
            mountTarget="#page-content"
            height="100%"
            width="100%"
            className="page-iframe"
            loading="lazy"
            style={{
              border: 'none',
              margin: 0,
              padding: 0,
              visibility: isCurrentPage ? 'visible' : 'hidden',
              display: isCurrentPage ? 'block' : 'none',
            }}
            contentDidMount={handleFrameMount}
            sandbox="allow-scripts allow-forms allow-popups allow-modals allow-storage-access-by-user-activation allow-same-origin"
            head={
              <>
                <style>
                  {`
              *:focus-visible {
                outline: none;
              }

              .page-editing {
                outline: 2px dashed #3b82f6 !important;
                outline-offset: -2px;
                min-height: 1em;
                position: relative;
              }

              [contenteditable="true"] {
                cursor: text;
              }
            `}
                </style>
              </>
            }
          >
            <div id={`page-${document.name}`} ref={contentRef}></div>
            <EditorOverlay
              selectedElement={selectedElement}
              hoveredElement={hoveredElement}
              setHoveredElement={setHoveredElement}
              setSelectedElement={setSelectedElement}
            />
          </Frame>
        )}
      </motion.div>
    );
  },
);
