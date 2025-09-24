import { useStore } from '@nanostores/react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { useLoaderData } from '@remix-run/react';
import classNames from 'classnames';
import { useAnimate } from 'framer-motion';
import { useEffect, useState } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { useShortcuts, useSnapScroll } from '~/lib/hooks';
import { useChatMessage } from '~/lib/hooks/useChatMessage';
import { aiState, setChatId, setChatStarted } from '~/lib/stores/ai-state';
import { webBuilderStore } from '~/lib/stores/web-builder';
import type { ChatMessage, ChatWithMessages } from '~/types/chat';
import { renderLogger } from '~/utils/logger';
import { Menu } from '../sidebar/Menu.client';
import { WebBuilder } from '../webbuilder/WebBuilder.client';
import styles from './BaseChat.module.scss';
import ChatAlert from './ChatAlert';
import { ChatTextarea } from './ChatTextarea';
import { ExamplePrompts } from './ExamplePrompts';
import FilePreview from './FilePreview';
import { Messages } from './Messages.client';
import ProgressCompilation from './ProgressCompilation';
import { ScreenshotStateManager } from './ScreenshotStateManager';

export type ImageData = {
  file: File;
  base64?: string;
};

export function Chat() {
  renderLogger.trace('Chat');
  const { id, chat } = useLoaderData<{ id?: string; chat: ChatWithMessages }>();

  const { showChat, chatStarted } = useStore(aiState);
  const actionAlert = useStore(webBuilderStore.chatStore.alert);
  useShortcuts();
  const [animationScope] = useAnimate();
  const [scrollRef] = useSnapScroll();
  const { progressAnnotations, abort, sendChatMessage } = useChatMessage({
    initialId: id,
    initialMessages: chat?.messages as unknown as ChatMessage[],
  });
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);

  useEffect(() => {
    if (id) {
      setChatId(id);
    }
  }, [id]);

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
            className={classNames(styles.BaseChat, 'relative flex size-full overflow-hidden')}
          >
            <ClientOnly>{() => <Menu />}</ClientOnly>
            <div ref={scrollRef} className="flex flex-col lg:flex-row size-full">
              <div className={classNames(styles.Chat, 'flex flex-col flex-grow lg:w-[var(--chat-width)] h-full')}>
                {!chatStarted && (
                  <div id="intro" className="mt-[18vh] max-w-chat mx-auto text-center px-4 lg:px-0">
                    <h1 className="text-3xl lg:text-6xl font-bold text-upage-elements-textPrimary mb-4 animate-fade-in">
                      使用 UPage 构建网站
                    </h1>
                    <p className="text-md lg:text-xl mb-8 text-upage-elements-textSecondary animate-fade-in animation-delay-200">
                      将想法快速转变成现实，并通过可视化实时呈现。
                    </p>
                  </div>
                )}
                <div
                  className={classNames('pt-6 px-1 sm:px-2', {
                    'h-full flex flex-col': chatStarted,
                  })}
                >
                  <ClientOnly>
                    {() => {
                      return chatStarted ? (
                        <Messages
                          ref={scrollRef}
                          className="flex flex-col w-full flex-1 max-w-chat mb-6 mx-auto z-1 overflow-y-auto"
                        />
                      ) : null;
                    }}
                  </ClientOnly>
                  <div
                    className={classNames('flex flex-col gap-4 w-full max-w-chat mx-auto z-prompt mb-6', {
                      'sticky bottom-2': chatStarted,
                    })}
                  >
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
                      <ClientOnly>
                        {() => <ScreenshotStateManager uploadFiles={uploadFiles} setUploadFiles={setUploadFiles} />}
                      </ClientOnly>
                      <ChatTextarea
                        onStopMessage={abort}
                        onSendMessage={handleSendMessage}
                        uploadFiles={uploadFiles}
                        setUploadFiles={setUploadFiles}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col justify-center gap-5">
                  {!chatStarted &&
                    ExamplePrompts((_event, messageInput) => {
                      handleSendMessage?.(messageInput);
                    })}
                </div>
              </div>
              <ClientOnly>{() => <WebBuilder />}</ClientOnly>
            </div>
          </div>
        </Tooltip.Provider>
      }
    </>
  );
}
