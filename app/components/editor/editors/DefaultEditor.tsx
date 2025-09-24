import React, { useState } from 'react';
import loadingSvg from '../icons/loading.svg?raw';
import sendSvg from '../icons/send.svg?raw';
import type { EditorProps } from './EditorProps';

/**
 * 默认编辑器组件，通用的 HTML 组件。
 */
export const DefaultEditor: React.FC<EditorProps> = ({ element, onSendPrompt }) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendPrompt = async () => {
    if (!prompt.trim()) {
      return;
    }

    setIsLoading(true);

    try {
      await onSendPrompt(prompt, element);

      setIsLoading(false);
    } catch (error) {
      console.error('AI 请求失败:', error);
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendPrompt();
    }
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          alignItems: 'end',
        }}
      >
        <textarea
          style={{
            width: '100%',
            border: 'none',
            outline: 'none',
            borderRadius: '8px',
            minHeight: '80px',
            resize: 'none',
            fontSize: '14px',
            lineHeight: '1.5',
            padding: '12px',
            paddingRight: '2px',
          }}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="描述想修改的逻辑或样式..."
          disabled={isLoading}
        />

        <button
          onClick={handleSendPrompt}
          disabled={isLoading || !prompt.trim()}
          style={{
            background: 'none',
            border: 'none',
            cursor: isLoading || !prompt.trim() ? 'default' : 'pointer',
            color: isLoading || !prompt.trim() ? '#cbd5e1' : '#3b82f6',
            padding: '4px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isLoading ? 0.7 : 1,
            paddingRight: '12px',
            paddingBottom: '12px',
          }}
        >
          {isLoading ? (
            <div dangerouslySetInnerHTML={{ __html: loadingSvg }} />
          ) : (
            <div dangerouslySetInnerHTML={{ __html: sendSvg }} />
          )}
        </button>
      </div>
    </div>
  );
};
