import React, { useRef } from 'react';
import { sendChatMessageStore } from '~/.client/stores/chat-message';
import { DefaultEditor } from './editors/DefaultEditor';
import type { EditorProps } from './editors/EditorProps';
import { IconEditor } from './editors/IconEditor';
import { ImageEditor } from './editors/ImageEditor';
import { LinkEditor } from './editors/LinkEditor';
import { TextEditor } from './editors/TextEditor';

export interface EditDialogProps {
  element: HTMLElement;
  onClose: () => void;
}

export type ElementType = 'text' | 'image' | 'link' | 'button' | 'input' | 'icon' | 'other';

export const getElementType = (element: HTMLElement): ElementType => {
  const tagName = element.tagName.toLowerCase();

  if (tagName === 'img') {
    return 'image';
  }
  if (tagName === 'a') {
    return 'link';
  }
  if (
    tagName === 'button' ||
    (tagName === 'div' && element.classList.contains('btn')) ||
    (tagName === 'span' && element.classList.contains('btn'))
  ) {
    return 'button';
  }
  if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
    return 'input';
  }
  if (tagName === 'iconify-icon') {
    return 'icon';
  }
  if (
    tagName === 'p' ||
    tagName === 'h1' ||
    tagName === 'h2' ||
    tagName === 'h3' ||
    tagName === 'h4' ||
    tagName === 'h5' ||
    tagName === 'h6' ||
    tagName === 'span'
  ) {
    return 'text';
  }
  return 'other';
};

const getEditorComponent = (elementType: ElementType): [React.FC<EditorProps>, string] => {
  switch (elementType) {
    case 'text':
      return [TextEditor, '编辑文本'];
    case 'image':
      return [ImageEditor, '编辑图片'];
    case 'link':
      return [LinkEditor, '编辑链接'];
    case 'icon':
      return [IconEditor, '更改图标'];
    default:
      return [DefaultEditor, '编辑元素'];
  }
};

export const EditDialog: React.FC<EditDialogProps> = ({ element, onClose }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const elementType = getElementType(element);
  const [EditorComponent, title] = getEditorComponent(elementType);

  const onSendPrompt = async (prompt: string, element: HTMLElement) => {
    const sendChatMessage = sendChatMessageStore.get();

    if (!sendChatMessage) {
      console.error('发送消息函数未初始化');
      return;
    }

    const elementInfo = {
      tagName: element.tagName,
      className: element.className,
      id: element.id,
      innerHTML: element.innerHTML,
      outerHTML: element.outerHTML,
    };

    try {
      sendChatMessage({
        messageContent: prompt,
        files: [],
        metadata: {
          elementInfo,
        },
      });
      onClose();
    } catch (error) {
      console.error('发送消息失败:', error);
    }
  };

  return (
    <div
      ref={dialogRef}
      onClick={(e) => e.stopPropagation()}
      style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        padding: '0',
        width: '100%',
        maxWidth: '420px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderBottom: '1px solid #e2e8f0',
          backgroundColor: '#f8fafc',
        }}
      >
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 500 }}>{title}</h3>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '18px',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#64748b',
          }}
        >
          ×
        </button>
      </div>

      <div style={{ padding: '16px' }}>
        <EditorComponent
          element={element}
          onClose={onClose}
          elementType={elementType}
          title={title}
          onSendPrompt={onSendPrompt}
        />
      </div>
    </div>
  );
};
