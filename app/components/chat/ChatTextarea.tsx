import { useStore } from '@nanostores/react';
import classNames from 'classnames';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { useAuth, usePromptEnhancer } from '~/lib/hooks';
import { aiState } from '~/lib/stores/ai-state';
import { IconButton } from '../ui/IconButton';
import { SendButton } from './SendButton.client';

interface ChatTextareaProps {
  uploadFiles: File[];
  setUploadFiles: (files: File[]) => void;
  onSendMessage: (message: string) => void;
  onStopMessage: () => void;
}

const TEXTAREA_MIN_HEIGHT = 76;

export const ChatTextarea = ({ uploadFiles, setUploadFiles, onSendMessage, onStopMessage }: ChatTextareaProps) => {
  const { isAuthenticated, signIn } = useAuth();
  const { chatStarted, isStreaming } = useStore(aiState);
  const { enhancedInput, isLoading, enhancePrompt, resetEnhancer } = usePromptEnhancer();

  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 检测当前 URL 是否包含登录回调参数
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedMessage = localStorage.getItem('pendingChatMessage');

      // 如果是从登录页面回调回来的，检查 localStorage 中是否有待发送的消息
      if (savedMessage && isAuthenticated) {
        try {
          const msgData = JSON.parse(savedMessage);
          requestAnimationFrame(() => {
            if (msgData.messageInput) {
              setInput(msgData.messageInput);
              sendMessage();
            }
          });
        } catch (e) {
          console.error('Error parsing saved message:', e);
        } finally {
          localStorage.removeItem('pendingChatMessage');
        }
      }
    }
  }, [isAuthenticated]);

  useEffect(() => {
    setInput(enhancedInput);
    scrollTextArea();
  }, [enhancedInput]);

  const TEXTAREA_MAX_HEIGHT = useMemo(() => {
    return chatStarted ? 400 : 200;
  }, [chatStarted]);

  const scrollTextArea = useCallback(() => {
    const textarea = textareaRef.current;

    if (textarea) {
      textarea.scrollTop = textarea.scrollHeight;
    }
  }, [textareaRef]);

  const handleEnhancePrompt = useCallback(async () => {
    try {
      await enhancePrompt(input);
    } catch (error) {
      console.error('Error enhancing prompt:', error);
    }
  }, [input]);

  const sendMessage = async () => {
    if (!input?.trim()) {
      return;
    }
    onSendMessage(input);
    setInput('');
    setUploadFiles([]);
    resetEnhancer();
    textareaRef.current?.blur();
  };

  useEffect(() => {
    const textarea = textareaRef.current;

    if (textarea) {
      textarea.style.height = 'auto';

      const scrollHeight = textarea.scrollHeight;

      textarea.style.height = `${Math.min(scrollHeight, TEXTAREA_MAX_HEIGHT)}px`;
      textarea.style.overflowY = scrollHeight > TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden';
    }
  }, [input, textareaRef]);

  const handleSendMessage = () => {
    if (!isAuthenticated) {
      if (input) {
        const savedMsg = {
          messageInput: input,
          timestamp: new Date().getTime(),
        };
        localStorage.setItem('pendingChatMessage', JSON.stringify(savedMsg));
        signIn();
        return;
      }
    }

    if (sendMessage) {
      sendMessage();
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;

    if (!items) {
      return;
    }

    const files: File[] = [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();

        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }
    handleFileReader(files);
  };

  const handleFileUpload = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      handleFileReader(files ? Array.from(files) : []);
    };

    input.click();
  }, [uploadFiles]);

  const handleFileReader = (files: File[]) => {
    files.forEach((file) => {
      setUploadFiles?.([...uploadFiles, file]);
    });
  };

  return (
    <div className={classNames('relative shadow-xs backdrop-blur rounded-lg')}>
      <textarea
        ref={textareaRef}
        className={classNames(
          'w-full pl-3 pt-3 pr-16 outline-none resize-none text-upage-elements-textPrimary placeholder-upage-elements-textTertiary bg-transparent text-sm',
          'transition-[opacity,border,width,padding] duration-200',
          'hover:border-upage-elements-focus',
        )}
        onDragEnter={(e) => {
          e.preventDefault();
          e.currentTarget.style.border = '2px solid #1488fc';
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.currentTarget.style.border = '2px solid #1488fc';
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.currentTarget.style.border = '1px solid var(--upage-elements-borderColor)';
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.currentTarget.style.border = '1px solid var(--upage-elements-borderColor)';

          const files = Array.from(e.dataTransfer.files);
          handleFileReader(files);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            if (event.shiftKey) {
              return;
            }

            event.preventDefault();

            // ignore if using input method engine
            if (event.nativeEvent.isComposing) {
              return;
            }

            handleSendMessage?.();
          }
        }}
        value={input}
        onChange={(e) => {
          setInput(e.target.value);
        }}
        onPaste={handlePaste}
        style={{
          minHeight: TEXTAREA_MIN_HEIGHT,
          maxHeight: TEXTAREA_MAX_HEIGHT,
        }}
        placeholder={isStreaming ? '正在构建中...' : !chatStarted ? '今天我能帮你做什么？' : '需要我优化哪些地方？'}
        translate="no"
      />
      <ClientOnly>
        {() => (
          <SendButton
            show={input.trim().length > 0 || isStreaming}
            isStreaming={isStreaming}
            onClick={() => {
              if (isStreaming) {
                onStopMessage?.();
                return;
              }

              if (input.trim().length > 0) {
                handleSendMessage?.();
              }
            }}
          />
        )}
      </ClientOnly>
      <div className="flex justify-between items-center text-sm p-3 pt-2">
        <div className="flex gap-1 items-center">
          <IconButton title="上传文件" className="transition-all" onClick={() => handleFileUpload()}>
            <div className="i-mingcute-attachment-2-line text-xl"></div>
          </IconButton>
          <IconButton
            title="优化提示词"
            disabled={input.length === 0 || isLoading}
            className={classNames('transition-all', isLoading ? 'opacity-100' : '')}
            onClick={handleEnhancePrompt}
          >
            {isLoading ? (
              <div className="i-svg-spinners:90-ring-with-bg text-upage-elements-loader-progress text-xl animate-spin"></div>
            ) : (
              <div className="i-mingcute:quill-pen-ai-line text-xl"></div>
            )}
          </IconButton>
        </div>
        {input.length > 3 ? (
          <div className="text-xs text-upage-elements-textTertiary">
            使用 <kbd className="kdb px-1.5 py-0.5 rounded bg-upage-elements-background-depth-2">Shift</kbd> +{' '}
            <kbd className="kdb px-1.5 py-0.5 rounded bg-upage-elements-background-depth-2">Return</kbd>
            换行
          </div>
        ) : null}
      </div>
    </div>
  );
};
