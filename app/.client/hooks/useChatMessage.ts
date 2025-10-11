import { useChat } from '@ai-sdk/react';
import { useStore } from '@nanostores/react';
import { useSearchParams } from '@remix-run/react';
import { DefaultChatTransport, type FileUIPart } from 'ai';
import { animate } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  aiState,
  getChatStarted,
  setAborted,
  setChatId,
  setChatStarted,
  setShowChat,
  setStreamingState,
  updateParseMessages,
} from '~/.client/stores/ai-state';
import { type SendChatMessageParams, setSendChatMessage } from '~/.client/stores/chat-message';
import { webBuilderStore } from '~/.client/stores/web-builder';
import { cubicEasingFn } from '~/.client/utils/easings';
import { pagesToArtifacts } from '~/.client/utils/page';
import type { ChatMessage } from '~/types/chat';
import type { ProgressAnnotation, UPageUIMessage } from '~/types/message';
import { createScopedLogger } from '~/utils/logger';
import { useChatUsage } from './useChatUsage';
import { useMessageParser } from './useMessageParser';
import { useProject } from './useProject';

const logger = createScopedLogger('useChatMessage');

export function useChatMessage({
  initialId,
  initialMessages,
}: {
  initialId?: string;
  initialMessages?: ChatMessage[];
}) {
  const SAVE_PROJECT_DELAY_MS = 1000;

  const [searchParams] = useSearchParams();
  const { chatStarted } = useStore(aiState);
  const { saveProject } = useProject();
  const { refreshUsageStats } = useChatUsage();
  const { parsedMessages, parseMessages } = useMessageParser();
  const [progressAnnotations, setProgressAnnotations] = useState<ProgressAnnotation[]>([]);
  const { id, messages, status, stop, sendMessage } = useChat<UPageUIMessage>({
    messages: initialMessages as unknown as UPageUIMessage[],
    transport: new DefaultChatTransport({
      api: '/api/chat',
      prepareSendMessagesRequest({ messages, body }) {
        return { body: { message: messages[messages.length - 1], ...body } };
      },
    }),
    // 节流，每 50ms 渲染一次 messages。
    experimental_throttle: 50,
    onData: (dataPart) => {
      if (dataPart.type === 'data-progress') {
        addProgressMessage(dataPart.data);
      }
    },
    onError: (e) => {
      logger.error('Request failed\n\n', e.message);
      toast.error('请求处理失败: ' + (e.message ? e.message : '没有返回详细信息'), { position: 'bottom-right' });

      addStoppedProgressMessage('网络连接中断，响应已停止');
    },
    onFinish: ({ message }) => {
      setTimeout(() => {
        // 保存 editor project
        saveProject(message.id);
      }, SAVE_PROJECT_DELAY_MS);
      refreshUsageStats();
      logger.debug('Finished streaming');
    },
  });

  const isLoading = useMemo(() => {
    return status === 'streaming';
  }, [status]);

  const currentChatId = useMemo(() => {
    return initialId || id;
  }, [initialId, id]);

  useEffect(() => {
    setSendChatMessage(sendChatMessage);
    if (initialMessages && initialMessages.length > 0) {
      setShowChat(true);
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      parseMessages(messages, isLoading);
    }
  }, [messages, isLoading, parseMessages]);

  useEffect(() => {
    if (currentChatId && chatStarted) {
      const url = new URL(window.location.href);
      url.pathname = `/chat/${currentChatId}`;
      window.history.replaceState({}, '', url);
      setChatId(currentChatId);
    }
  }, [currentChatId, chatStarted]);

  useEffect(() => {
    if (messages.length > 0) {
      updateParseMessages(messages, parsedMessages);
    }
  }, [parsedMessages]);

  useEffect(() => {
    setStreamingState(status === 'streaming');
    if (status === 'submitted') {
      setProgressAnnotations([]);
    }
  }, [status]);

  const addProgressMessage = (progress: ProgressAnnotation) => {
    setProgressAnnotations((prev) => [...prev, progress]);
  };

  const addStoppedProgressMessage = (message: string) => {
    if (progressAnnotations.length === 0) {
      return;
    }

    const lastProgressMessage = progressAnnotations[progressAnnotations.length - 1];
    const newProgressMessage = {
      type: 'progress',
      label: lastProgressMessage.label,
      status: 'stopped',
      order: lastProgressMessage.order + 1,
      message,
    } as ProgressAnnotation;
    addProgressMessage(newProgressMessage);
  };

  const abort = () => {
    stop();
    setAborted(true);
    webBuilderStore.chatStore.abortAllActions();
    addStoppedProgressMessage('响应已中断');
    logger.debug('Chat response aborted');
  };

  const runAnimation = async () => {
    if (getChatStarted()) {
      return;
    }

    await Promise.all([
      animate('#examples', { opacity: 0, display: 'none' }, { duration: 0.1 }),
      animate('#intro', { opacity: 0, flex: 1 }, { duration: 0.2, ease: cubicEasingFn }),
    ]);

    setChatStarted(true);
  };

  const fileToBase64 = (file: File): Promise<string | ArrayBuffer | null> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const filesToFileUIPart = async (files: File[]): Promise<FileUIPart[]> => {
    const fileParts: FileUIPart[] = [];

    await Promise.all(
      files.map(async (file) => {
        const base64 = await fileToBase64(file);
        fileParts.push({
          type: 'file',
          mediaType: file.type,
          filename: file.name,
          url: base64 as string,
        });
      }),
    );
    return fileParts;
  };

  const sendChatMessage = async ({ messageContent, files, metadata }: SendChatMessageParams) => {
    if (!messageContent?.trim()) {
      return;
    }

    if (isLoading) {
      abort();
      return;
    }

    const fileDataList = await filesToFileUIPart(files);

    runAnimation();

    const modifiedPages = webBuilderStore.pagesStore.getModifiedPages();
    const sections = webBuilderStore.pagesStore.sections;

    const userUpdateArtifact = modifiedPages !== undefined ? pagesToArtifacts(modifiedPages, sections) : '';

    sendMessage(
      {
        text: modifiedPages !== undefined ? `${userUpdateArtifact}${messageContent}` : messageContent,
        metadata,
        files: fileDataList,
      },
      {
        body: {
          chatId: currentChatId,
          rewindTo: searchParams.get('rewindTo'),
        },
      },
    );

    if (modifiedPages !== undefined) {
      webBuilderStore.pagesStore.resetPageModifications();
    }
  };

  return {
    messages,
    progressAnnotations,
    isLoading,
    abort,
    sendChatMessage,
  };
}
