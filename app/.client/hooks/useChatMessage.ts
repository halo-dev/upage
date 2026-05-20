import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { extractBrandNameFromDesignMd } from '~/.client/utils/design-system';
import { createScopedLogger } from '~/.client/utils/logger';
import type { ChatMessage } from '~/types/chat';
import type {
  ChatDescriptionAnnotation,
  ChatUIMessage,
  PreparationStageAnnotation,
  ProgressAnnotation,
} from '~/types/message';
import {
  getChatStarted,
  getDesignMd,
  getPendingUserChoice,
  isDesignMdUserRemoved,
  setAborted,
  setAwaitingUserChoice,
  setChatStarted,
  setDesignSystem,
  setPendingUserChoice,
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
  const activeDraftMessageIdRef = useRef<string | undefined>(undefined);
  const draftSaveTimerRef = useRef<number | undefined>(undefined);

  const [searchParams, setSearchParams] = useSearchParams();
  const { saveProject, saveDraftProject } = useProject();
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
      if (dataPart.type === 'data-chat-description') {
        webBuilderStore.chatStore.applyGeneratedDescription((dataPart.data as ChatDescriptionAnnotation).description);
      }
      if (dataPart.type === 'data-user-choice') {
        const choiceData = dataPart.data as {
          status: 'pending' | 'completed';
          request: import('~/types/page-builder-tools').UserChoiceRequest;
        };
        if (choiceData.status === 'pending') {
          setAwaitingUserChoice(true);
          setPendingUserChoice(choiceData.request);
        }
      }
    },
    onError: (e) => {
      setRequestPhase('idle');
      setStreamingState(false);
      if (abortRequestedRef.current || isAbortLikeError(e)) {
        logger.debug('请求已按用户操作中断');
        if (activeDraftMessageIdRef.current) {
          void saveDraftProject(activeDraftMessageIdRef.current);
        }
        return;
      }

      const errorMessage = e instanceof Error ? e.message : '未知错误';
      logger.error(`请求处理失败: ${errorMessage}`);
      toast.error(`请求处理失败: ${errorMessage}`, { position: 'bottom-right' });
      if (activeDraftMessageIdRef.current) {
        void saveDraftProject(activeDraftMessageIdRef.current);
      }

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

      const draftMessageId = activeDraftMessageIdRef.current;
      lastStableMessageIdRef.current = message.id;
      syncRewindTo(message.id);
      setAborted(false);
      setRequestPhase('idle');
      setStreamingState(false);
      setAwaitingUserChoice(false);
      setPendingUserChoice(undefined);
      webBuilderStore.chatStore.setCurrentMessageId(message.id);
      if (draftSaveTimerRef.current) {
        window.clearTimeout(draftSaveTimerRef.current);
      }
      setTimeout(() => {
        void saveProject(message.id, {
          clearDraftMessageId: draftMessageId,
        });
      }, SAVE_PROJECT_DELAY_MS);
      activeDraftMessageIdRef.current = undefined;
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
    if (!isLoading || activeDraftMessageIdRef.current) {
      return;
    }

    const latestUserMessage = [...messages].reverse().find((item) => item.role === 'user');
    if (!latestUserMessage?.id) {
      return;
    }

    activeDraftMessageIdRef.current = latestUserMessage.id;
    webBuilderStore.chatStore.setCurrentMessageId(latestUserMessage.id);
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isLoading || !activeDraftMessageIdRef.current) {
      return;
    }

    if (draftSaveTimerRef.current) {
      window.clearTimeout(draftSaveTimerRef.current);
    }

    draftSaveTimerRef.current = window.setTimeout(() => {
      const draftMessageId = activeDraftMessageIdRef.current;
      if (!draftMessageId) {
        return;
      }
      void saveDraftProject(draftMessageId);
    }, SAVE_PROJECT_DELAY_MS);

    return () => {
      if (draftSaveTimerRef.current) {
        window.clearTimeout(draftSaveTimerRef.current);
      }
    };
  }, [messages, isLoading, saveDraftProject]);

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

  const abort = () => {
    abortRequestedRef.current = true;
    stop();
    setAborted(true);
    setRequestPhase('idle');
    setStreamingState(false);
    webBuilderStore.chatStore.setCurrentMessageId(activeDraftMessageIdRef.current || lastStableMessageIdRef.current);
    webBuilderStore.chatStore.abortAllActions();
    addStoppedProgressMessage('响应已中断');
    if (activeDraftMessageIdRef.current) {
      void saveDraftProject(activeDraftMessageIdRef.current);
    }
    logger.debug('流式响应中断');
  };

  const runAnimation = async () => {
    if (getChatStarted()) {
      return;
    }

    setChatStarted(true);
  };

  const sendUserChoice = async (response: import('~/types/page-builder-tools').UserChoiceResponse) => {
    const { choiceId, selectedOptionIds, customText } = response;
    const pendingChoice = getPendingUserChoice();
    if (!pendingChoice || pendingChoice.choiceId !== choiceId) {
      return;
    }

    setAwaitingUserChoice(false);
    setPendingUserChoice(undefined);

    const selectedLabels = pendingChoice.options
      .filter((opt: { id: string }) => selectedOptionIds.includes(opt.id))
      .map((opt: { label: string }) => opt.label);
    const summaryParts = [...selectedLabels];
    if (customText) {
      summaryParts.push(customText);
    }
    const messageContent = summaryParts.length > 0 ? `我的选择：${summaryParts.join('、')}` : '我已做出选择';

    sendMessage(
      {
        text: messageContent,
        metadata: {
          choiceData: {
            version: 1,
            response,
          },
        },
      },
      {
        body: {
          chatId: id,
          rewindTo: searchParams.get('rewindTo') || undefined,
          designMd: getDesignMd(),
          designMdRemoved: isDesignMdUserRemoved(),
          pageSnapshot: buildPageSnapshotForRequest({
            rewindTo: searchParams.get('rewindTo'),
            allPages: webBuilderStore.pagesStore.pages.get(),
            modifiedPages: webBuilderStore.pagesStore.getModifiedPages(),
            sections: webBuilderStore.pagesStore.sections,
          }),
        },
      },
    );
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
    activeDraftMessageIdRef.current = undefined;
    lastStableMessageIdRef.current =
      webBuilderStore.chatStore.currentMessageId.get() || messages[messages.length - 1]?.id;
    setProgressAnnotations([createInitialProgressAnnotation()]);

    const fileDataList = await filesToFileUIParts(files);

    runAnimation();
    webBuilderStore.chatStore.ensureDescription();

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
    sendUserChoice,
  };
}
