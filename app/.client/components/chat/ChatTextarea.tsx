import { useStore } from '@nanostores/react';
import classNames from 'classnames';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { useAuth, usePromptEnhancer } from '~/.client/hooks';
import { aiState, removeDesignSystem, setDesignSystem } from '~/.client/stores/ai-state';
import { IconButton } from '../ui/IconButton';
import { DesignSystemPicker } from './DesignSystemPicker';
import { SendButton } from './SendButton';

interface ChatTextareaProps {
  uploadFiles: File[];
  setUploadFiles: (files: File[]) => void;
  onSendMessage: (message: string) => void;
  onStopMessage?: () => void;
}

const TEXTAREA_MIN_HEIGHT = 84;

export const ChatTextarea = ({ uploadFiles, setUploadFiles, onSendMessage, onStopMessage }: ChatTextareaProps) => {
  const { isAuthenticated, signIn } = useAuth();
  const { chatStarted, isStreaming, requestPhase, designMd, designBrand } = useStore(aiState);
  const { enhancedInput, isLoading, enhancePrompt, resetEnhancer } = usePromptEnhancer();
  const isRequestActive = requestPhase === 'submitted' || requestPhase === 'streaming';

  const [input, setInput] = useState('');
  const [isPickerOpen, setIsPickerOpen] = useState(false);
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
  }, [input, textareaRef, TEXTAREA_MAX_HEIGHT]);

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

  const placeholder = getTextareaPlaceholder({
    requestPhase,
    isStreaming,
    chatStarted,
  });

  return (
    <div className={classNames('relative rounded-[18px] bg-transparent')}>
      <textarea
        ref={textareaRef}
        className={classNames(
          'w-full resize-none bg-transparent pl-4 pr-18 pt-4 text-sm leading-6 text-upage-elements-textPrimary outline-none placeholder-upage-elements-textTertiary',
          'transition-[opacity,border,width,padding] duration-200',
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
        placeholder={placeholder}
        translate="no"
      />
      <ClientOnly>
        {() => (
          <SendButton
            show={input.trim().length > 0 || isRequestActive}
            isRunning={isRequestActive}
            onClick={() => {
              if (isRequestActive) {
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
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-upage-elements-borderColor/50 px-3.5 pb-3 pt-2.5 text-sm">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <IconButton
            title="上传文件"
            className="rounded-lg bg-upage-elements-background-depth-2/55 px-2 py-1.5 transition-all hover:bg-upage-elements-background-depth-2"
            onClick={() => handleFileUpload()}
          >
            <div className="i-mingcute-attachment-2-line text-xl"></div>
          </IconButton>
          <IconButton
            title="优化提示词"
            disabled={input.length === 0 || isLoading}
            className={classNames(
              'rounded-lg bg-upage-elements-background-depth-2/55 px-2 py-1.5 transition-all hover:bg-upage-elements-background-depth-2',
              isLoading ? 'opacity-100' : '',
            )}
            onClick={handleEnhancePrompt}
          >
            {isLoading ? (
              <div className="i-svg-spinners:90-ring-with-bg text-upage-elements-loader-progress text-xl animate-spin"></div>
            ) : (
              <div className="i-mingcute:quill-pen-ai-line text-xl"></div>
            )}
          </IconButton>
          <IconButton
            title="选择设计风格"
            className={classNames(
              'rounded-lg bg-upage-elements-background-depth-2/55 px-2 py-1.5 transition-all hover:bg-upage-elements-background-depth-2',
              designMd ? 'text-blue-500' : '',
            )}
            onClick={() => setIsPickerOpen(true)}
          >
            <div className="i-ph:paint-brush text-xl"></div>
          </IconButton>
          {designMd && (
            <div className="flex min-w-0 max-w-full items-center gap-1 overflow-hidden rounded-full border border-blue-200/80 bg-blue-50/85 px-2 py-1 text-xs font-medium text-blue-600 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400">
              <span className="i-ph:paint-brush w-3 h-3 flex-shrink-0" />
              <span className="min-w-0 max-w-[96px] truncate sm:max-w-[140px]" title={designBrand || '已选设计风格'}>
                {designBrand || '已选风格'}
              </span>
              <button
                className="ml-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-md transition-colors hover:bg-blue-200 dark:hover:bg-blue-500/30"
                onClick={() => removeDesignSystem()}
                title="移除设计风格"
              >
                <div className="i-ph:x w-3 h-3" />
              </button>
            </div>
          )}
        </div>
        <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1.5 pb-0.5 text-xs text-upage-elements-textTertiary">
          {uploadFiles.length > 0 ? (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-upage-elements-background-depth-2 px-2 py-1"
              title={`已添加 ${uploadFiles.length} 个附件`}
            >
              <span className="i-mingcute:attachment-2-line h-3.5 w-3.5 flex-shrink-0" />
              <span>{uploadFiles.length}</span>
            </span>
          ) : null}
          <span
            className={classNames(
              'inline-flex items-center gap-1 rounded-full bg-upage-elements-background-depth-2 px-2 py-1 transition-opacity',
              input.length > 3 || uploadFiles.length > 0 ? 'opacity-100' : 'pointer-events-none opacity-0',
            )}
            aria-hidden={input.length > 3 || uploadFiles.length > 0 ? undefined : true}
            title="Shift + Return 换行"
          >
            <span className="i-ph:key-return h-3.5 w-3.5 flex-shrink-0" />
            <kbd className="kdb rounded-md bg-upage-elements-background px-1.5 py-0.5">Shift</kbd>
            <span>+</span>
            <kbd className="kdb rounded-md bg-upage-elements-background px-1.5 py-0.5">Enter</kbd>
          </span>
        </div>
      </div>
      <DesignSystemPicker
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelect={(brand, content) => {
          setDesignSystem(content, brand);
        }}
      />
    </div>
  );
};

function getTextareaPlaceholder({
  requestPhase,
  isStreaming,
  chatStarted,
}: {
  requestPhase: string;
  isStreaming: boolean;
  chatStarted: boolean;
}) {
  if (requestPhase === 'submitted') {
    return '正在分析上下文...';
  }

  if (isStreaming) {
    return '正在构建中...';
  }

  if (!chatStarted) {
    return '描述你想生成的页面、风格和目标用户';
  }

  return '继续补充需求，或告诉我下一步要优化什么';
}
