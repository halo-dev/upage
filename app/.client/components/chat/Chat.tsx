import type { Route } from '.react-router/types/app/routes/+types/chat';
import { useStore } from '@nanostores/react';
import * as Tooltip from '@radix-ui/react-tooltip';
import classNames from 'classnames';
import { useAnimate } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useSnapScroll } from '~/.client/hooks';
import { useChatMessage } from '~/.client/hooks/useChatMessage';
import { aiState, clearDesignSystem, setChatId, setChatStarted, setDesignSystem } from '~/.client/stores/ai-state';
import { webBuilderStore } from '~/.client/stores/web-builder';
import { extractBrandNameFromDesignMd } from '~/.client/utils/design-system';
import type { ChatMessage } from '~/types/chat';
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

export function getChatArtifactSyncState(
  displayedMessages: Array<Pick<ChatMessage, 'id'>>,
  reloadedMessages?: Array<Pick<ChatMessage, 'id'>>,
) {
  return {
    displayedMessageIds: displayedMessages.map((message) => message.id),
    reloadedMessageIds: reloadedMessages?.map((message) => message.id) || [],
  };
}

export function getChatStateAfterInitialMessage(state?: { designMd?: string; designBrand?: string }) {
  if (!state?.designMd) {
    return null;
  }

  return {
    designMd: state.designMd,
    designBrand: state.designBrand,
  };
}

export function Chat({ loaderData, className }: Route.ComponentProps & { className?: string }) {
  const { id, chat } = loaderData;

  const location = useLocation();
  const locationState = location.state as {
    message?: string;
    files?: File[];
    designMd?: string;
    designBrand?: string;
  };
  const navigate = useNavigate();
  const { showChat } = useStore(aiState);
  const actionAlert = useStore(webBuilderStore.chatStore.alert);
  const [animationScope] = useAnimate();
  const [scrollRef] = useSnapScroll();

  const { messages, renderedTexts, progressAnnotations, abort, sendChatMessage } = useChatMessage({
    initialId: id,
    initialMessages: chat?.messages as unknown as ChatMessage[],
  });

  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const hasProcessedStateRef = useRef(false);

  useEffect(() => {
    const persistedDesignMd = chat?.metadata?.designMd;

    if (persistedDesignMd) {
      setDesignSystem(persistedDesignMd, extractBrandNameFromDesignMd(persistedDesignMd));
      return;
    }

    if (locationState?.designMd) {
      setDesignSystem(
        locationState.designMd,
        locationState.designBrand || extractBrandNameFromDesignMd(locationState.designMd),
      );
      return;
    }

    clearDesignSystem();
  }, [chat?.metadata?.designMd, locationState?.designBrand, locationState?.designMd]);

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

    navigate(location.pathname, {
      replace: true,
      state: getChatStateAfterInitialMessage(locationState),
    });
  }, [location.key]);

  // Set the global chat ID
  useEffect(() => {
    if (id) {
      setChatId(id);
    }
  }, [id]);

  // Based on the chat information, set messages
  useEffect(() => {
    const { displayedMessageIds, reloadedMessageIds } = getChatArtifactSyncState(messages, chat?.messages);

    if (!chat && displayedMessageIds.length === 0) {
      webBuilderStore.chatStore.pruneArtifacts([]);
      return;
    }

    if (displayedMessageIds.length > 0) {
      setChatStarted(true);
    }
    webBuilderStore.chatStore.pruneArtifacts(displayedMessageIds);
    webBuilderStore.chatStore.setReloadedMessages(reloadedMessageIds);
  }, [chat, messages]);

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
            className={classNames(styles.BaseChat, 'relative h-full min-h-0 overflow-hidden', className)}
          >
            <div ref={scrollRef} className="flex h-full min-h-0 w-full flex-col overflow-hidden lg:flex-row">
              <div
                className={classNames(
                  styles.Chat,
                  'flex min-h-0 h-[calc(100vh-var(--header-height))] w-full flex-grow flex-col overflow-hidden lg:w-[var(--chat-width)]',
                )}
              >
                <div className="flex h-full min-h-0 flex-col gap-6 px-2 pb-4 pt-6 sm:px-4">
                  <Messages
                    ref={scrollRef}
                    className="mx-auto flex min-h-0 w-full max-w-chat flex-1 flex-col overflow-y-auto"
                    messages={messages}
                    renderedTexts={renderedTexts}
                  />
                  <div className="mx-auto flex w-full max-w-chat flex-col gap-4">
                    <div className="rounded-xl bg-upage-elements-background-depth-2/35">
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
                        'relative z-prompt mx-auto w-full max-w-chat overflow-hidden rounded-xl border border-upage-elements-borderColor/70 bg-upage-elements-background/92 shadow-[0_18px_44px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-colors focus-within:border-upage-elements-focus/70',
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
