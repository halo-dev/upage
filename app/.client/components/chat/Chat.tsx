import { useStore } from '@nanostores/react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useLoaderData, useLocation, useNavigate } from 'react-router';
import classNames from 'classnames';
import { useAnimate } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useSnapScroll } from '~/.client/hooks';
import { useChatMessage } from '~/.client/hooks/useChatMessage';
import { aiState, setChatId, setChatStarted } from '~/.client/stores/ai-state';
import { webBuilderStore } from '~/.client/stores/web-builder';
import { renderLogger } from '~/.client/utils/logger';
import type { ChatMessage, ChatWithMessages } from '~/types/chat';
import { WebBuilder } from '../webbuilder/WebBuilder';
import styles from './BaseChat.module.scss';
import ChatAlert from './ChatAlert';
import { ChatTextarea } from './ChatTextarea';
import FilePreview from './FilePreview';
import { Messages } from './Messages';
import ProgressCompilation from './ProgressCompilation';
import { ScreenshotStateManager } from './ScreenshotStateManager';

export type ImageData = {
  file: File;
  base64?: string;
};

export function Chat({ className }: { className?: string }) {
  renderLogger.trace('Chat');
  const location = useLocation();
  const locationState = location.state as { message?: string; files?: File[] };

  const { id, chat } = useLoaderData<{ id: string; chat?: ChatWithMessages }>();
  const navigate = useNavigate();
  const { showChat } = useStore(aiState);
  const actionAlert = useStore(webBuilderStore.chatStore.alert);
  const [animationScope] = useAnimate();
  const [scrollRef] = useSnapScroll();

  const { progressAnnotations, abort, sendChatMessage } = useChatMessage({
    initialId: id,
    initialMessages: chat?.messages as unknown as ChatMessage[],
  });

  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const hasProcessedStateRef = useRef(false);

  // Generally, entering from the homepage will carry messages and files.
  useEffect(() => {
    if (hasProcessedStateRef.current || !locationState) {
      return;
    }

    const hasContent = locationState.message || locationState.files;
    if (!hasContent) {
      return;
    }

    hasProcessedStateRef.current = true;

    if (locationState.files) {
      setUploadFiles(locationState.files);
    }

    if (locationState.message) {
      sendChatMessage({
        messageContent: locationState.message,
        files: locationState.files || [],
      });
    }

    navigate(location.pathname, { replace: true, state: null });
  }, [location.key]);

  // Set the global chat ID
  useEffect(() => {
    if (id) {
      setChatId(id);
    }
  }, [id]);

  // Based on the chat information, set messages
  useEffect(() => {
    if (!chat) {
      return;
    }
    const { messages } = chat;
    if (messages.length > 0) {
      setChatStarted(true);
    }
    webBuilderStore.chatStore.setReloadedMessages(messages.map((m) => m.id));
  }, [chat]);

  const handleSendMessage = (messageInput?: string) => {
    if (!messageInput) {
      return;
    }
    sendChatMessage({ messageContent: messageInput, files: uploadFiles });
  };

  return (
    <>
      {
        <Tooltip.Provider delayDuration={200}>
          <div
            ref={animationScope}
            data-chat-visible={showChat}
            className={classNames(styles.BaseChat, 'relative h-full', className)}
          >
            <div ref={scrollRef} className="flex flex-col lg:flex-row w-full h-full">
              <div
                className={classNames(
                  styles.Chat,
                  'flex flex-col flex-grow lg:w-[var(--chat-width)] w-full h-[calc(100vh-var(--header-height))]',
                )}
              >
                <div className="pt-6 px-1 sm:px-2 h-full flex flex-col gap-6">
                  <Messages
                    ref={scrollRef}
                    className="flex flex-col flex-1 w-full max-w-chat mx-auto overflow-y-auto"
                  />
                  <div className="flex flex-col gap-4 w-full max-w-chat mx-auto bottom-6 relative">
                    <div className="bg-upage-elements-background-depth-2">
                      {actionAlert && (
                        <ChatAlert
                          postMessage={(message) => {
                            handleSendMessage?.(message);
                          }}
                        />
                      )}
                    </div>
                    {progressAnnotations && <ProgressCompilation data={progressAnnotations} />}
                    <div
                      className={classNames(
                        'bg-upage-elements-background-depth-2 p-1 rounded-lg border border-upage-elements-borderColor relative w-full max-w-chat mx-auto z-prompt',
                      )}
                    >
                      <FilePreview
                        files={uploadFiles}
                        onRemove={(index: number) => {
                          setUploadFiles?.(uploadFiles.filter((_, i) => i !== index));
                        }}
                      />
                      <ScreenshotStateManager uploadFiles={uploadFiles} setUploadFiles={setUploadFiles} />
                      <ChatTextarea
                        onStopMessage={abort}
                        onSendMessage={handleSendMessage}
                        uploadFiles={uploadFiles}
                        setUploadFiles={setUploadFiles}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <WebBuilder />
            </div>
          </div>
        </Tooltip.Provider>
      }
    </>
  );
}
