import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { extractBrandNameFromDesignMd } from '~/.client/utils/design-system';
import { createScopedLogger } from '~/.client/utils/logger';
import type { ChatMessage } from '~/types/chat';
import type { ChatUIMessage, PreparationStageAnnotation, ProgressAnnotation } from '~/types/message';
import {
  getChatStarted,
  getDesignMd,
  isDesignMdUserRemoved,
  setAborted,
  setChatStarted,
  setDesignSystem,
  setRequestPhase,
  setShowChat,
  setStreamingState,
} from '../stores/ai-state';
import { clearSendChatMessage, type SendChatMessageParams, setSendChatMessage } from '../stores/chat-message';
import { webBuilderStore } from '../stores/web-builder';
import {
  buildNextRewindSearchParams,
  buildPageSnapshotForRequest,
  createInitialProgressAnnotation,
  createStoppedProgressMessage,
  filesToFileUIParts,
  getActiveRewindTo,
  getRequestPhase,
  isAbortLikeError,
  mapPreparationStageToProgress,
} from './chat-message-utils';
import { mergeStreamingProgressAnnotations } from './chat-progress';

export { getActiveRewindTo } from './chat-message-utils';

import { useChatHistory } from './useChatHistory';
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
  const abortRequestedRef = useRef(false);
  const lastStableMessageIdRef = useRef<string | undefined>(initialMessages?.[initialMessages.length - 1]?.id);

  const [searchParams, setSearchParams] = useSearchParams();
  const { saveProject } = useProject();
  const chatHistory = useChatHistory();
  const { refreshUsageStats } = useChatUsage();
  const { renderedTexts, parseMessages, resetParser } = useMessageParser();
  const [progressAnnotations, setProgressAnnotations] = useState<ProgressAnnotation[]>([]);
  const { id, messages, status, stop, sendMessage } = useChat<ChatUIMessage>({
    id: initialId,
    messages: initialMessages as unknown as ChatUIMessage[],
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
        addProgressMessage(dataPart.data as ProgressAnnotation);
      }
      if (dataPart.type === 'data-preparation-stage') {
        addProgressMessage(mapPreparationStageToProgress(dataPart.data as PreparationStageAnnotation));
      }
      if (dataPart.type === 'data-design-md') {
        const { content } = dataPart.data as { content: string };
        if (content && !isDesignMdUserRemoved()) {
          const brand = extractBrandNameFromDesignMd(content);
          setDesignSystem(content, brand);
        }
      }
    },
    onError: (e) => {
      setRequestPhase('idle');
      setStreamingState(false);
      if (abortRequestedRef.current || isAbortLikeError(e)) {
        logger.debug('请求已按用户操作中断');
        return;
      }

      const errorMessage = e instanceof Error ? e.message : '未知错误';
      logger.error(`请求处理失败: ${errorMessage}`);
      toast.error(`请求处理失败: ${errorMessage}`, { position: 'bottom-right' });

      // 如果最后一条进度已经是 stopped 状态（服务端主动写入），则不重复追加
      setProgressAnnotations((prev) => {
        const last = prev[prev.length - 1];
        if (!last || last.status === 'stopped') {
          return prev;
        }
        return [
          ...prev,
          {
            type: 'progress',
            label: last.label,
            status: 'stopped',
            order: last.order + 1,
            message: '网络连接中断，响应已停止',
          } as ProgressAnnotation,
        ];
      });
    },
    onFinish: ({ message }) => {
      if (abortRequestedRef.current) {
        abortRequestedRef.current = false;
        refreshUsageStats();
        logger.debug('流式响应已中断，跳过自动保存');
        return;
      }

      lastStableMessageIdRef.current = message.id;
      syncRewindTo(message.id);
      setAborted(false);
      setRequestPhase('idle');
      setTimeout(() => {
        // 保存 editor project
        saveProject(message.id);
      }, SAVE_PROJECT_DELAY_MS);
      refreshUsageStats();
      logger.debug('流式响应完成');
    },
  });

  const isLoading = useMemo(() => {
    return status === 'submitted' || status === 'streaming';
  }, [status]);

  const combinedProgressAnnotations = useMemo(() => {
    return mergeStreamingProgressAnnotations(progressAnnotations, messages);
  }, [messages, progressAnnotations]);

  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      setShowChat(true);
    }
    return () => {
      resetParser();
    };
  }, [initialMessages, resetParser]);

  useEffect(() => {
    resetParser();
  }, [id, resetParser]);

  useEffect(() => {
    parseMessages(messages, isLoading);
  }, [messages, isLoading, parseMessages]);

  useEffect(() => {
    const latestAssistantMessage = [...messages].reverse().find((item) => item.role === 'assistant');
    if (!latestAssistantMessage) {
      return;
    }

    const designSystemPart = latestAssistantMessage.parts.find(
      (part) => part.type === 'tool-ensureDesignSystem' && part.state === 'output-available',
    );

    if (!designSystemPart) {
      return;
    }

    const content = designSystemPart.output.content;
    if (content && !isDesignMdUserRemoved()) {
      const brand = extractBrandNameFromDesignMd(content);
      setDesignSystem(content, brand);
    }
  }, [messages]);

  useEffect(() => {
    const nextPhase = getRequestPhase(status);
    setRequestPhase(nextPhase);
    setStreamingState(status === 'streaming');
  }, [status]);

  const addProgressMessage = (progress: ProgressAnnotation) => {
    setProgressAnnotations((prev) => [...prev, progress]);
  };

  const syncRewindTo = (messageId: string) => {
    const nextSearchParams = buildNextRewindSearchParams(searchParams, messageId);
    if (!nextSearchParams) {
      return;
    }

    setSearchParams(nextSearchParams, { replace: true });
  };

  const addStoppedProgressMessage = (message: string) => {
    const stoppedProgressMessage = createStoppedProgressMessage(progressAnnotations, message);
    if (!stoppedProgressMessage) {
      return;
    }

    addProgressMessage(stoppedProgressMessage);
  };

  const restoreStableProjectSnapshot = async () => {
    const messageId = lastStableMessageIdRef.current;
    if (!messageId) {
      return;
    }

    const projectData = await chatHistory?.getProjectByMessageId?.(messageId);
    if (!projectData?.pages) {
      return;
    }

    webBuilderStore.restoreProjectSnapshot(projectData.pages, projectData.sections);
  };

  const abort = () => {
    abortRequestedRef.current = true;
    stop();
    setAborted(true);
    setRequestPhase('idle');
    setStreamingState(false);
    webBuilderStore.chatStore.setCurrentMessageId(lastStableMessageIdRef.current);
    webBuilderStore.chatStore.abortAllActions();
    addStoppedProgressMessage('响应已中断');
    void restoreStableProjectSnapshot();
    logger.debug('流式响应中断');
  };

  const runAnimation = async () => {
    if (getChatStarted()) {
      return;
    }

    setChatStarted(true);
  };

  const sendChatMessage = async ({ messageContent, files, metadata }: SendChatMessageParams) => {
    if (!messageContent?.trim()) {
      return;
    }

    if (isLoading) {
      abort();
      return;
    }

    abortRequestedRef.current = false;
    setAborted(false);
    setRequestPhase('submitted');
    lastStableMessageIdRef.current =
      webBuilderStore.chatStore.currentMessageId.get() || messages[messages.length - 1]?.id;
    setProgressAnnotations([createInitialProgressAnnotation()]);

    const fileDataList = await filesToFileUIParts(files);

    runAnimation();

    const rewindTo = getActiveRewindTo({
      rewindTo: searchParams.get('rewindTo'),
      lastStableMessageId: lastStableMessageIdRef.current,
    });
    const modifiedPages = webBuilderStore.pagesStore.getModifiedPages();
    const sections = webBuilderStore.pagesStore.sections;
    const pageSnapshot = buildPageSnapshotForRequest({
      rewindTo,
      allPages: webBuilderStore.pagesStore.pages.get(),
      modifiedPages,
      sections,
    });

    sendMessage(
      {
        text: messageContent,
        metadata,
        files: fileDataList,
      },
      {
        body: {
          chatId: id,
          rewindTo,
          designMd: getDesignMd(),
          designMdRemoved: isDesignMdUserRemoved(),
          pageSnapshot,
        },
      },
    );

    if (modifiedPages !== undefined) {
      webBuilderStore.pagesStore.resetPageModifications();
    }
  };

  useEffect(() => {
    setSendChatMessage(sendChatMessage);
    return () => {
      clearSendChatMessage();
    };
  }, [sendChatMessage]);

  return {
    messages,
    renderedTexts,
    progressAnnotations: combinedProgressAnnotations,
    isLoading,
    abort,
    sendChatMessage,
  };
}
