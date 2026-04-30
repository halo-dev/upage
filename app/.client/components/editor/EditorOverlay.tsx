import {
  autoUpdate,
  flip,
  offset,
  shift,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
} from '@floating-ui/react';
import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useFrame } from 'react-frame-component';
import { EditDialog } from './EditDialog';

export interface EditorOverlayProps {
  selectedElement: HTMLElement | null;
  hoveredElement: HTMLElement | null;
  setHoveredElement: (element: HTMLElement | null) => void;
  setSelectedElement: (element: HTMLElement | null) => void;
}

function getTargetElement(target: EventTarget | null): HTMLElement | null {
  if (!target || typeof target !== 'object') {
    return null;
  }

  const targetNode = target as Node;
  if (targetNode.nodeType === Node.ELEMENT_NODE) {
    return targetNode as HTMLElement;
  }

  if (targetNode.nodeType === Node.TEXT_NODE) {
    return targetNode.parentElement;
  }

  return null;
}

function isOverlayTarget(target: HTMLElement | null, shadowRoot: ShadowRoot | null) {
  if (!target) {
    return false;
  }

  if (target.id === 'editor-overlay' || target.closest('#editor-overlay')) {
    return true;
  }

  if (!shadowRoot) {
    return false;
  }

  return target.getRootNode() === shadowRoot;
}

const shadowDomStyles = `
  .overlay-container {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 999996;
  }

  .hover-overlay {
    position: absolute;
    pointer-events: none;
    box-sizing: border-box;
    z-index: 999997;
    background-color: rgba(0, 102, 255, 0.1);
    border: 1px dashed rgb(0, 87, 255);
  }

  .select-overlay {
    position: absolute;
    pointer-events: none;
    box-sizing: border-box;
    z-index: 999997;
    border: 1px dashed rgb(0, 87, 255);
  }

  .editor-dialog {
    position: absolute;
    z-index: 999998;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    min-width: 320px;
    pointer-events: auto;
    max-height: 80vh;
    overflow: hidden;
  }

  /* 自定义箭头样式 */
  .floating-arrow {
    position: absolute;
    width: 12px;
    height: 12px;
    transform: rotate(45deg);
    background: white;
    z-index: 999997;
    border: 1px solid #e2e8f0;
  }
`;

/**
 * 编辑器覆盖层组件，负责在 iframe 内创建和管理覆盖层。
 * 覆盖层用于操作和修改 HTML 元素。
 * 为防止样式覆盖，因此使用 Shadow DOM 创建覆盖层。
 */
export const EditorOverlay: React.FC<EditorOverlayProps> = ({
  selectedElement,
  hoveredElement,
  setHoveredElement,
  setSelectedElement,
}) => {
  const { document: iframeDocument, window: iframeWindow } = useFrame();
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null);
  const [selectRect, setSelectRect] = useState<DOMRect | null>(null);
  const [shadowRoot, setShadowRoot] = useState<ShadowRoot | null>(null);
  const hoveredElementRef = useRef<HTMLElement | null>(null);
  const selectedElementRef = useRef<HTMLElement | null>(null);

  const { refs: hoverRefs, floatingStyles: hoverFloatingStyles } = useFloating({
    elements: {
      reference: hoveredElement ?? undefined,
    },
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(({ rects }) => {
        return -rects.reference.height / 2 - rects.floating.height / 2;
      }),
    ],
  });

  const { refs: selectRefs, floatingStyles: selectFloatingStyles } = useFloating({
    elements: {
      reference: selectedElement ?? undefined,
    },
    whileElementsMounted: autoUpdate,
    middleware: [
      offset(({ rects }) => {
        return -rects.reference.height / 2 - rects.floating.height / 2;
      }),
    ],
  });

  const { refs, floatingStyles, context } = useFloating({
    elements: {
      reference: selectedElement ?? undefined,
    },
    whileElementsMounted: autoUpdate,
    placement: 'bottom',
    middleware: [
      offset(10),
      flip({
        fallbackPlacements: ['top'],
        crossAxis: true,
        boundary: iframeDocument?.body || undefined,
      }),
      shift({
        padding: 10,
        limiter: {
          options: {
            offset: 100,
          },
          fn: (state) => {
            const { x, y } = state;
            return {
              x,
              y,
            };
          },
        },
      }),
    ],
  });

  const { getFloatingProps } = useInteractions([useClick(context), useDismiss(context)]);

  useEffect(() => {
    hoveredElementRef.current = hoveredElement;
  }, [hoveredElement]);

  useEffect(() => {
    selectedElementRef.current = selectedElement;
  }, [selectedElement]);

  useEffect(() => {
    if (hoveredElement && hoverRefs.reference.current !== hoveredElement) {
      hoverRefs.reference.current = hoveredElement;
    }
  }, [hoveredElement, hoverRefs]);

  useEffect(() => {
    if (selectedElement && selectRefs.reference.current !== selectedElement) {
      selectRefs.reference.current = selectedElement;
    }
  }, [selectedElement, selectRefs]);

  useEffect(() => {
    if (selectedElement && refs.reference.current !== selectedElement) {
      refs.reference.current = selectedElement;
    }
  }, [selectedElement, refs]);

  useEffect(() => {
    if (!iframeDocument || !iframeWindow) {
      return;
    }

    const container = iframeDocument.createElement('div');
    container.id = 'editor-overlay';

    iframeDocument.body.appendChild(container);
    const shadow = container.attachShadow({ mode: 'open' });

    const style = iframeDocument.createElement('style');
    style.textContent = shadowDomStyles;
    shadow.appendChild(style);

    const contentContainer = iframeDocument.createElement('div');
    contentContainer.className = 'overlay-container';
    shadow.appendChild(contentContainer);

    setShadowRoot(shadow);

    return () => {
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
    };
  }, [iframeDocument, iframeWindow]);

  useEffect(() => {
    if (!iframeDocument || !iframeWindow) {
      return;
    }

    const updateHoveredElement = (target: HTMLElement | null) => {
      if (!target || target === iframeDocument.body || target === iframeDocument.documentElement) {
        if (hoveredElementRef.current) {
          hoveredElementRef.current = null;
          setHoveredElement(null);
          setHoverRect(null);
        }
        return;
      }

      if (hoveredElementRef.current === target) {
        return;
      }

      hoveredElementRef.current = target;
      setHoveredElement(target);

      const rect = target.getBoundingClientRect();
      setHoverRect({
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        x: rect.x,
        y: rect.y,
        toJSON: rect.toJSON,
      });
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = getTargetElement(e.target);
      if (isOverlayTarget(target, shadowRoot)) {
        return;
      }

      e.stopPropagation();
      updateHoveredElement(target);
    };

    const handleClick = (e: MouseEvent) => {
      const target = getTargetElement(e.target);
      if (isOverlayTarget(target, shadowRoot)) {
        return;
      }

      const selectedTarget = selectedElementRef.current;
      const allowNativeEditingClick = Boolean(
        target &&
          selectedTarget &&
          selectedTarget.isContentEditable &&
          (target === selectedTarget || selectedTarget.contains(target)),
      );

      if (!allowNativeEditingClick) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }

      if (!target || target === iframeDocument.body || target === iframeDocument.documentElement) {
        return;
      }

      if (selectedElementRef.current === target) {
        return;
      }

      selectedElementRef.current = target;
      setSelectedElement(target);

      const rect = target.getBoundingClientRect();
      setSelectRect({
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        x: rect.x,
        y: rect.y,
        toJSON: rect.toJSON,
      });
    };

    const handleSubmit = (e: Event) => {
      e.preventDefault();
    };

    const handleMouseOut = (e: MouseEvent) => {
      if (!e.relatedTarget || !iframeDocument.contains(e.relatedTarget as Node)) {
        hoveredElementRef.current = null;
        setHoveredElement(null);
        setHoverRect(null);
      }
    };

    iframeDocument.body.addEventListener('mouseover', handleMouseOver, true);
    iframeDocument.body.addEventListener('click', handleClick, true);
    iframeDocument.body.addEventListener('submit', handleSubmit);
    iframeDocument.addEventListener('mouseout', handleMouseOut);

    return () => {
      iframeDocument.body.removeEventListener('mouseover', handleMouseOver, true);
      iframeDocument.body.removeEventListener('click', handleClick, true);
      iframeDocument.body.removeEventListener('submit', handleSubmit);
      iframeDocument.removeEventListener('mouseout', handleMouseOut);
    };
  }, [iframeDocument, iframeWindow, shadowRoot, setHoveredElement, setSelectedElement, setHoverRect, setSelectRect]);

  if (!iframeDocument || !shadowRoot) {
    return null;
  }

  const overlayContainer = shadowRoot.querySelector('.overlay-container');

  if (!overlayContainer) {
    return null;
  }

  return ReactDOM.createPortal(
    <>
      {hoveredElement && hoverRect && (
        <div
          ref={hoverRefs.setFloating}
          className="hover-overlay"
          style={{
            ...hoverFloatingStyles,
            width: `${hoverRect.width}px`,
            height: `${hoverRect.height}px`,
          }}
        />
      )}
      {selectedElement && selectRect && (
        <div
          ref={selectRefs.setFloating}
          className="select-overlay"
          style={{
            ...selectFloatingStyles,
            width: `${selectRect.width}px`,
            height: `${selectRect.height}px`,
          }}
        />
      )}
      {selectedElement && (
        <div ref={refs.setFloating} className="editor-dialog" style={floatingStyles} {...getFloatingProps()}>
          <EditDialog element={selectedElement} onClose={() => setSelectedElement(null)} />
        </div>
      )}
    </>,
    overlayContainer as Element,
  );
};
