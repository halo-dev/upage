import React, { memo, useState } from 'react';
import type { EditorProps } from './EditorProps';

/**
 * 链接编辑器组件，用于编辑链接元素。
 */
export const LinkEditor: React.FC<EditorProps> = memo(({ element }) => {
  const linkElement = element as HTMLAnchorElement;
  const [href, setHref] = useState(linkElement.getAttribute('href') || '');
  const [content, setContent] = useState(linkElement.innerHTML);
  const [target, setTarget] = useState(linkElement.target);

  const handleHrefChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newHref = e.target.value;
    setHref(newHref);
    linkElement.href = newHref;
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    linkElement.innerHTML = newContent;
  };

  const handleTargetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTarget = e.target.value;
    setTarget(newTarget);
    linkElement.target = newTarget;
  };

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>链接地址</label>
        <input
          type="text"
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid #cbd5e1',
            outline: 'none',
            borderRadius: '4px',
            boxSizing: 'border-box',
          }}
          value={href}
          onChange={handleHrefChange}
          placeholder="https://upage.ai"
        />
      </div>

      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>链接文本</label>
        <input
          type="text"
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid #cbd5e1',
            outline: 'none',
            borderRadius: '4px',
            boxSizing: 'border-box',
          }}
          value={content}
          onChange={handleContentChange}
          placeholder="链接文本"
        />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>打开方式</label>
        <select
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid #cbd5e1',
            outline: 'none',
            borderRadius: '4px',
            backgroundColor: 'white',
            boxSizing: 'border-box',
          }}
          value={target}
          onChange={handleTargetChange}
        >
          <option value="">当前窗口</option>
          <option value="_blank">新窗口</option>
          <option value="_self">当前框架</option>
          <option value="_parent">父框架</option>
          <option value="_top">整个窗口</option>
        </select>
      </div>
    </div>
  );
});
