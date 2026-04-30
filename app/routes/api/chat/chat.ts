import { createAgentUIStream, createUIMessageStream, createUIMessageStreamResponse, type LanguageModelUsage } from 'ai';
import type { ActionFunctionArgs } from 'react-router';
import { createPageBuilderAgent } from '~/.server/llm/agents/page-builder';
import { PAGE_GENERATION_STEP_LIMIT } from '~/.server/llm/agents/page-generation';
import type { StreamTextUIEvent } from '~/.server/llm/ui-message-stream';
import { createUserPageSnapshotContext, getUserMessageContent } from '~/.server/llm/utils';
import { DEFAULT_MODEL, DEFAULT_PROVIDER, MINOR_MODEL } from '~/.server/modules/constants';
import { getModelCapabilities } from '~/.server/modules/llm/capabilities';
import { updateChat, upsertChat } from '~/.server/service/chat';
import {
  materializeMessagesFileReferencesForModel,
  normalizeMessageFileReferences,
} from '~/.server/service/chat-file-reference';
import { ChatUsageStatus, recordUsage, updateUsageStatus } from '~/.server/service/chat-usage';
import {
  getHistoryChatMessages,
  saveChatMessages,
  updateDiscardedMessage,
  upgradeLegacyMessagesForContinuation,
} from '~/.server/service/message';
import { prisma } from '~/.server/service/prisma';
import { createScopedLogger } from '~/.server/utils/logger';
import { accumulateUsageSnapshot, createEmptyTokenUsage, estimateAgentStepAbortUsage } from '~/.server/utils/token';
import type { ChatMetadata } from '~/types/chat';
import type {
  ChatUIMessage,
  PreparationStageAnnotation,
  UPageBlockAnnotation,
  UserPageSnapshot,
} from '~/types/message';
import { resolveChatMetadataForRequest } from './metadata';
import {
  createChatStreamEventWriters,
  resolveAssistantRunStatus,
  resolveChatUsageStatus,
  resolveGuardrailStopReason,
  resolveStreamErrorMessage,
  sanitizeMessagesForAgent,
  withAssistantRunMetadata,
} from './runtime';

const logger = createScopedLogger('api.chat.chat');

export type ElementInfo = {
  tagName: string;
  className?: string;
  id?: string;
  domId?: string;
  innerHTML?: string;
  outerHTML?: string;
};

export type ChatActionParams = {
  // 当前会话 ID
  chatId: string;
  // 回退到指定消息 ID
  rewindTo: string;
  // 最后一条消息，通常是用户消息。
  message: ChatUIMessage;
  // 如果用户指定编辑的元素，则需要传递该元素的信息。
  elementInfo: ElementInfo;
  // 用户选择或已生成的设计系统规范（DESIGN.md 格式）
  designMd?: string;
  // 用户是否主动移除了当前设计系统
  designMdRemoved?: boolean;
  // 用户当前尚未持久化的页面快照
  pageSnapshot?: UserPageSnapshot;
};

export type ChatActionArgs = ActionFunctionArgs & {
  userId: string;
};

export async function chatAction({ request, userId }: ChatActionArgs) {
  const {
    rewindTo,
    chatId,
    message: incomingMessage,
    designMd: clientDesignMd,
    designMdRemoved,
    pageSnapshot,
  } = await request.json<ChatActionParams>();
  const message = await normalizeMessageFileReferences({
    userId,
    messageId: incomingMessage.id,
    message: incomingMessage,
  });
  const chat = await upsertChat({
    id: chatId,
    userId,
  });
  const chatMetadata =
    chat.metadata && typeof chat.metadata === 'object' && !Array.isArray(chat.metadata)
      ? (chat.metadata as ChatMetadata)
      : null;

  const { nextMetadata, shouldUpdate } = resolveChatMetadataForRequest({
    chatMetadata,
    clientDesignMd,
    designMdRemoved,
  });

  if (shouldUpdate) {
    await updateChat(chat.id, {
      metadata: nextMetadata,
    });
  }

  const effectiveChatMetadata = shouldUpdate ? nextMetadata : (chatMetadata ?? nextMetadata);
  const persistedDesignMd = designMdRemoved ? '' : (effectiveChatMetadata.designMd ?? '');

  const elementInfo = message.metadata?.elementInfo;
  const messageId = message.id;
  const messageContent = message.role === 'user' ? getUserMessageContent(message) : '';
  const initialUsageRecord = await recordUsage({
    userId,
    chatId: chat.id,
    messageId,
    status: ChatUsageStatus.PENDING,
    prompt: messageContent || '',
    modelName: DEFAULT_MODEL,
  });

  const minorModelInitialUsageRecord = await recordUsage({
    userId,
    chatId: chat.id,
    messageId,
    status: ChatUsageStatus.PENDING,
    prompt: messageContent || '',
    modelName: MINOR_MODEL,
  });

  const cumulativeUsage = createEmptyTokenUsage();
  const minorModelCumulativeUsage = createEmptyTokenUsage();

  // 辅助函数：更新辅助模型使用量
  const updateMinorModelUsage = (usage: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    reasoningTokens?: number;
    cachedInputTokens?: number;
  }) => {
    minorModelCumulativeUsage.inputTokens += usage.inputTokens || 0;
    minorModelCumulativeUsage.outputTokens += usage.outputTokens || 0;
    minorModelCumulativeUsage.totalTokens += usage.totalTokens || 0;
    minorModelCumulativeUsage.reasoningTokens += usage.reasoningTokens || 0;
    minorModelCumulativeUsage.cachedInputTokens += usage.cachedInputTokens || 0;
  };

  // 计算用户 token 消耗
  const calculateTokenUsage = async (status: ChatUsageStatus) => {
    try {
      await updateUsageStatus(initialUsageRecord.id, status, {
        inputTokens: cumulativeUsage.inputTokens,
        outputTokens: cumulativeUsage.outputTokens,
        reasoningTokens: cumulativeUsage.reasoningTokens,
        cachedTokens: cumulativeUsage.cachedInputTokens,
        totalTokens: cumulativeUsage.totalTokens,
      });
      logger.debug(`用户 ${userId} 的聊天: ${chat.id} 总使用量为: ${JSON.stringify(cumulativeUsage)}`);
      logger.debug(`用户 ${userId} 的聊天: ${chat.id} 使用状态已更新为 ${status}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logger.error(`更新用户 ${userId} 的使用状态时出错: ${errorMessage}`);
    }
  };

  // 计算用户 token 消耗
  const calculateMinorModelTokenUsage = async (status: ChatUsageStatus) => {
    try {
      await updateUsageStatus(minorModelInitialUsageRecord.id, status, {
        inputTokens: minorModelCumulativeUsage.inputTokens,
        outputTokens: minorModelCumulativeUsage.outputTokens,
        reasoningTokens: minorModelCumulativeUsage.reasoningTokens,
        cachedTokens: minorModelCumulativeUsage.cachedInputTokens,
        totalTokens: minorModelCumulativeUsage.totalTokens,
      });
      logger.debug(`用户 ${userId} 的聊天: ${chat.id} 辅助模型使用状态已更新为 ${status}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logger.error(`更新用户 ${userId} 的辅助模型使用状态时出错: ${errorMessage}`);
      // 记录错误但不中断流程
    }
  };

  // 获取从第一条到当前消息之间的所有消息
  const previousMessages = await getHistoryChatMessages({
    chatId,
    rewindTo,
  });
  const upgradedPreviousMessages = upgradeLegacyMessagesForContinuation(previousMessages);
  const messages = [...upgradedPreviousMessages, message];
  const primaryModelCapabilities = getModelCapabilities(DEFAULT_PROVIDER, DEFAULT_MODEL);
  const allowFileParts = primaryModelCapabilities.supportsVisionInput;
  const referencedMessages = allowFileParts
    ? await materializeMessagesFileReferencesForModel({
        request,
        userId,
        messages,
        supportsImageUrl: primaryModelCapabilities.supportsImageUrl,
        supportsBase64Image: primaryModelCapabilities.supportsBase64Image,
      })
    : messages;
  const agentMessages = sanitizeMessagesForAgent(referencedMessages, {
    allowFileParts,
  });
  const userPageContext = createUserPageSnapshotContext(pageSnapshot);

  let streamFailed = false;
  let finalFinishReason: string | undefined;
  let finalStepCount = 0;
  let completedPrimaryStepCount = 0;
  const designStreamPartId = `design-md-${chat.id}-${messageId}`;
  let writeDesignSystemStreamEvent: ((event: StreamTextUIEvent) => void) | undefined;
  let writeUpageBlockStartEvent: ((block: UPageBlockAnnotation) => void) | undefined;
  let writePreparationStageEvent: ((event: PreparationStageAnnotation) => void) | undefined;
  const completedPrimaryUsage = createEmptyTokenUsage();
  let primaryUsageFlushed = false;
  const { agent, state } = createPageBuilderAgent({
    request,
    chatId: chat.id,
    chatMetadata: effectiveChatMetadata,
    previousMessages: upgradedPreviousMessages,
    currentMessage: message,
    persistedDesignMd,
    clientDesignMd,
    pageSnapshot,
    userPageContext,
    elementInfo,
    onMinorModelUsage: updateMinorModelUsage,
    onDesignSystemStreamEvent: (event) => {
      writeDesignSystemStreamEvent?.(event);
    },
    onUpageBlockStart: (block) => {
      writeUpageBlockStartEvent?.(block);
    },
    onPreparationStage: (event) => {
      writePreparationStageEvent?.(event);
    },
    onFinish: ({ finishReason, steps }: { finishReason?: string; steps: unknown[] }) => {
      finalFinishReason = finishReason;
      finalStepCount = steps.length;
    },
  });
  const stream = createUIMessageStream<ChatUIMessage>({
    originalMessages: messages,
    execute: async ({ writer }) => {
      ({ writePreparationStageEvent, writeUpageBlockStartEvent, writeDesignSystemStreamEvent } =
        createChatStreamEventWriters({
          writer,
          messageId,
          designStreamPartId,
        }));

      const agentStream = await createAgentUIStream({
        agent,
        uiMessages: agentMessages as unknown[],
        abortSignal: request.signal,
        sendReasoning: true,
        onStepFinish: ({ usage }: { usage: LanguageModelUsage }) => {
          completedPrimaryStepCount += 1;
          accumulateUsageSnapshot(completedPrimaryUsage, usage);
        },
      });

      writer.merge(agentStream as Parameters<typeof writer.merge>[0]);
    },
    onFinish: async (event: {
      messages: unknown[];
      isAborted: boolean;
      responseMessage: unknown;
      finishReason?: string;
    }) => {
      const nextMessages = event.messages as unknown as ChatUIMessage[];
      const isAborted = event.isAborted;
      const responseMessage = event.responseMessage as unknown as ChatUIMessage;
      const finishReason = event.finishReason;

      if (!primaryUsageFlushed) {
        accumulateUsageSnapshot(cumulativeUsage, completedPrimaryUsage);
        primaryUsageFlushed = true;
      }

      if (isAborted && state.preparedStepCount > completedPrimaryStepCount) {
        const abortedStepUsage = estimateAgentStepAbortUsage({
          system: state.lastPreparedStep?.system,
          messages: state.lastPreparedStep?.messages,
          responseParts: responseMessage.parts,
        });
        accumulateUsageSnapshot(cumulativeUsage, abortedStepUsage);
      }

      const status = resolveChatUsageStatus({
        creditRejected: false,
        isAborted,
        streamFailed,
      });
      const assistantRunStatus = resolveAssistantRunStatus({
        creditRejected: false,
        isAborted,
        streamFailed,
      });
      const errorPhase = streamFailed ? state.errorPhase || 'agent_loop_failed' : undefined;
      const guardrailStopReason = resolveGuardrailStopReason({
        guardrailStopReason: state.guardrailStopReason,
        streamFailed,
        finalStepCount,
        pageGenerationStepLimit: PAGE_GENERATION_STEP_LIMIT,
        finishReason,
        finalFinishReason,
      });

      const persistedMessages = withAssistantRunMetadata({
        messages: nextMessages,
        responseMessageId: responseMessage.id,
        assistantRunStatus,
        finishReason,
        finalFinishReason,
        finalStepCount,
        errorPhase,
        lastEffectiveTool: state.lastEffectiveTool,
        invalidStepCount: state.invalidStepCount,
        effectiveMutationCount: state.effectiveMutationCount,
        guardrailStopReason,
      });

      await Promise.all([calculateTokenUsage(status), calculateMinorModelTokenUsage(status)]);

      if (isAborted) {
        logger.info(`用户 ${userId} 的聊天: ${chatId} 中止处理完成`);
        return;
      }

      await prisma.$transaction(async (tx) => {
        if (rewindTo) {
          await updateDiscardedMessage(chatId, rewindTo, tx);
        }
        await saveChatMessages(chatId, persistedMessages, tx);
      });
    },
    onError: (error: unknown) => {
      streamFailed = true;
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logger.error(`用户 ${userId} 的聊天: ${chatId} 处理过程中发生错误 ===> ${errorMessage}`);

      if (!state.errorPhase) {
        state.errorPhase = 'agent_loop_failed';
      }

      return resolveStreamErrorMessage(state.errorPhase);
    },
  });

  return createUIMessageStreamResponse({ stream });
}
