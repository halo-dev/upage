import { forwardRef, useRef } from 'react';
import Frame from 'react-frame-component';

export interface EditorRenderProps {
  onMount: (iframe: HTMLIFrameElement | null) => void;
  children?: React.ReactNode;
}

/**
 * 使用 HTML 来渲染编辑器。并在 HTML 有所变化时，调用更新函数。
 * 为了保证纯净性，此函数将只考虑渲染 HTML 以及更新，与外部的所有交互无关。
 */
export const EditorRender = forwardRef<HTMLDivElement, EditorRenderProps>(({ onMount, children }, ref) => {
  const frameRef = useRef<HTMLIFrameElement | null>(null);

  // 初始化的 HTML 内容，如果有 HTML 所需的一些外部资源，可以在这里添加。但需要注意的是，导出时，需要将这些资源也导出。
  const initialContent = `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          html, body {
            margin: 0;
            height: 100%;
            width: 100%;
          }
          iframe {
            border: none;
          }
          .page-iframe {
            align-items: center;
            display: flex;
            height: 100%;
            justify-content: center;
            width: 100%;
          }
        </style>
      </head>
      <body>
        <div id="editor-content"></div>
      </body>
    </html>
  `;

  return (
    <div className="editor-render w-full h-full relative">
      <Frame
        ref={frameRef}
        initialContent={initialContent}
        mountTarget="#editor-content"
        height="100%"
        width="100%"
        className="w-full h-full"
        style={{ border: 'none', margin: 0, padding: 0 }}
        contentDidMount={() => {
          onMount(frameRef.current);
        }}
        sandbox="allow-scripts allow-same-origin allow-downloads allow-popups allow-top-navigation-by-user-activation allow-top-navigation-to-custom-protocols"
        head={
          <>
            <style>
              {`
              *:focus-visible {
                outline: none;
              }

              #editor-content, .frame-content {
                height: 100%;
                width: 100%;
                margin: 0;
                padding: 0;
                display: block;
              }

              .editor-editing {
                outline: 2px dashed #3b82f6 !important;
                outline-offset: -2px;
                min-height: 1em;
                position: relative;
              }
            `}
            </style>
          </>
        }
      >
        <div ref={ref} style={{ width: '100%', height: '100%', margin: 0, padding: 0 }}>
          {children}
        </div>
      </Frame>
    </div>
  );
});
