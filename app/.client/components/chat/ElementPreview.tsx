import classNames from 'classnames';
import React, { useMemo } from 'react';

interface ElementPreviewProps {
  element: {
    tagName: string;
    className?: string;
    id?: string;
    innerHTML?: string;
    outerHTML?: string;
  };
}

export const ElementPreview: React.FC<ElementPreviewProps> = ({ element }) => {
  // 提取元素标识符
  const elementIdentifier = useMemo(() => {
    const parts = [];
    parts.push(element.tagName.toLowerCase());

    if (element.className) {
      const classes = element.className.split(' ').filter(Boolean);
      if (classes.length > 0) {
        parts.push(`.${classes[0]}`);
      }
    }

    if (element.id) {
      parts.push(`#${element.id}`);
    }

    return parts.join('');
  }, [element]);

  // 安全地渲染元素预览
  // 注意：使用 dangerouslySetInnerHTML 需要确保内容是安全的
  return (
    <div className="element-preview p-3 border border-upage-elements-borderColor rounded bg-white">
      <div className="flex items-center gap-2 mb-2">
        <div className="i-ph:code text-upage-elements-textSecondary"></div>
        <div className="text-xs font-mono text-upage-elements-textSecondary">{elementIdentifier}</div>
      </div>
      <div
        className={classNames(
          'preview-container p-2 border border-dashed border-upage-elements-borderColor rounded',
          'max-h-[200px] overflow-auto',
        )}
      >
        {element.outerHTML ? (
          <div dangerouslySetInnerHTML={{ __html: element.outerHTML }} />
        ) : element.innerHTML ? (
          <div dangerouslySetInnerHTML={{ __html: element.innerHTML }} />
        ) : (
          <div className="text-xs text-upage-elements-textTertiary italic">无法显示元素预览</div>
        )}
      </div>
    </div>
  );
};
