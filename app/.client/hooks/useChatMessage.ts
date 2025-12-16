import { useChat } from '@ai-sdk/react';
import { useSearchParams } from '@remix-run/react';
import { DefaultChatTransport, type FileUIPart } from 'ai';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { createScopedLogger } from '~/.client/utils/logger';
import { pagesToArtifacts } from '~/.client/utils/page';
import type { ChatMessage } from '~/types/chat';
import type { ProgressAnnotation, UPageUIMessage } from '~/types/message';
import {
  getChatStarted,
  setAborted,
  setChatStarted,
  setShowChat,
  setStreamingState,
  updateParseMessages,
} from '../stores/ai-state';
import { type SendChatMessageParams, setSendChatMessage } from '../stores/chat-message';
import { webBuilderStore } from '../stores/web-builder';
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
  const { saveProject } = useProject();
  const { refreshUsageStats } = useChatUsage();
  const { parsedMessages, parseMessages } = useMessageParser();
  const [progressAnnotations, setProgressAnnotations] = useState<ProgressAnnotation[]>([]);
  const { id, messages, status, stop, sendMessage } = useChat<UPageUIMessage>({
    id: initialId,
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
      const errorMessage = e instanceof Error ? e.message : '未知错误';
      logger.error(`请求处理失败: ${errorMessage}`);
      toast.error(`请求处理失败: ${errorMessage}`, { position: 'bottom-right' });

      addStoppedProgressMessage('网络连接中断，响应已停止');
    },
    onFinish: ({ message }) => {
      setTimeout(() => {
        // 保存 editor project
        saveProject(message.id);
      }, SAVE_PROJECT_DELAY_MS);
      refreshUsageStats();
      logger.debug('流式响应完成');
    },
  });

  const isLoading = useMemo(() => {
    return status === 'streaming';
  }, [status]);

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
    logger.debug('流式响应中断');
  };

  const runAnimation = async () => {
    if (getChatStarted()) {
      return;
    }

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
          chatId: id,
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
