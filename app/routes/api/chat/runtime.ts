import { createStreamTextUIMessageWriter } from '~/.server/llm/ui-message-stream';
import { createVisualHintText, hasUserImageParts } from '~/.server/llm/utils';
import { ChatUsageStatus } from '~/.server/service/chat-usage';
import type {
  AgentErrorPhase,
  AgentRunStatus,
  ChatUIMessage,
  GuardrailStopReason,
  PreparationStageAnnotation,
  UPageBlockAnnotation,
} from '~/types/message';
import { extractRenderableStructuredPageParts } from '~/utils/message-parts';

type ChatStreamWriter = Parameters<typeof createStreamTextUIMessageWriter>[0]['writer'];

export function createChatStreamEventWriters({
  writer,
  messageId,
  designStreamPartId,
}: {
  writer: ChatStreamWriter;
  messageId: string;
  designStreamPartId: string;
}) {
  const writePreparationStageEvent = (event: PreparationStageAnnotation) => {
    writer.write({
      type: 'data-preparation-stage',
      id: `preparation-stage-${messageId}-${event.order}`,
      data: event,
    });
  };

  const writeUpageBlockStartEvent = (block: UPageBlockAnnotation) => {
    writer.write({
      type: 'data-upage-block-start',
      id: `upage-block-start-${messageId}-${block.artifact.id}-${block.action.id}`,
      data: block,
    });
  };

  const writeDesignSystemStreamEvent = createStreamTextUIMessageWriter({
    writer,
    idPrefix: designStreamPartId,
    onText: ({ chunk, text }) => {
      if (chunk.type !== 'text-delta' || !text) {
        return;
      }

      writer.write({
        type: 'data-design-md',
        id: designStreamPartId,
        data: {
          content: text,
        },
      });
    },
  });

  return {
    writePreparationStageEvent,
    writeUpageBlockStartEvent,
    writeDesignSystemStreamEvent,
  };
}

export function resolveChatUsageStatus({
  creditRejected = false,
  isAborted,
  streamFailed,
}: {
  creditRejected?: boolean;
  isAborted: boolean;
  streamFailed: boolean;
}) {
  if (creditRejected || streamFailed) {
    return ChatUsageStatus.FAILED;
  }

  if (isAborted) {
    return ChatUsageStatus.ABORTED;
  }

  return ChatUsageStatus.SUCCESS;
}

export function resolveAssistantRunStatus({
  creditRejected = false,
  isAborted,
  streamFailed,
}: {
  creditRejected?: boolean;
  isAborted: boolean;
  streamFailed: boolean;
}): AgentRunStatus {
  if (creditRejected || streamFailed) {
    return 'failed';
  }

  if (isAborted) {
    return 'aborted';
  }

  return 'completed';
}

export function resolveGuardrailStopReason({
  guardrailStopReason,
  streamFailed,
  finalStepCount,
  pageGenerationStepLimit,
  finishReason,
  finalFinishReason,
}: {
  guardrailStopReason?: GuardrailStopReason;
  streamFailed: boolean;
  finalStepCount: number;
  pageGenerationStepLimit: number;
  finishReason?: string;
  finalFinishReason?: string;
}) {
  const effectiveFinishReason = finishReason || finalFinishReason;
  const exceededStepBudget =
    !streamFailed && finalStepCount >= pageGenerationStepLimit && effectiveFinishReason === 'tool-calls';

  return guardrailStopReason || (exceededStepBudget ? 'step_budget_exceeded' : undefined);
}

export function withAssistantRunMetadata({
  messages,
  responseMessageId,
  assistantRunStatus,
  finishReason,
  finalFinishReason,
  finalStepCount,
  errorPhase,
  lastEffectiveTool,
  invalidStepCount,
  effectiveMutationCount,
  guardrailStopReason,
}: {
  messages: ChatUIMessage[];
  responseMessageId?: string;
  assistantRunStatus: AgentRunStatus;
  finishReason?: string;
  finalFinishReason?: string;
  finalStepCount: number;
  errorPhase?: AgentErrorPhase;
  lastEffectiveTool?: string;
  invalidStepCount: number;
  effectiveMutationCount: number;
  guardrailStopReason?: GuardrailStopReason;
}) {
  return messages.map((item) => {
    if (!responseMessageId || item.id !== responseMessageId) {
      return item;
    }

    return {
      ...item,
      metadata: {
        ...(item.metadata ?? {}),
        protocolVersion: 'structured-parts-v2' as const,
        runMode: 'agent-runtime-v1' as const,
        runStatus: assistantRunStatus,
        finishReason: finishReason || finalFinishReason,
        stepCount: finalStepCount,
        errorPhase,
        lastEffectiveTool,
        invalidStepCount,
        effectiveMutationCount,
        guardrailStopReason,
      },
    };
  });
}

export function resolveStreamErrorMessage(errorPhase?: AgentErrorPhase) {
  if (errorPhase === 'design_system_failed') {
    return '设计系统规范生成失败，请稍后重试';
  }

  if (errorPhase === 'summary_failed' || errorPhase === 'context_failed') {
    return '上下文分析失败，请稍后重试';
  }

  return '内部服务器错误，请稍后重试';
}

export function sanitizeMessagesForAgent(
  messages: ChatUIMessage[],
  options: {
    allowFileParts?: boolean;
  } = {},
): ChatUIMessage[] {
  return messages.map((message) => {
    const nextParts = (message.parts || []).filter(
      (part) => part.type === 'text' || part.type === 'reasoning' || (options.allowFileParts && part.type === 'file'),
    );

    const structuredSummary = summarizeStructuredPagePartsForAgent(message);
    if (structuredSummary) {
      nextParts.push({
        type: 'text',
        text: structuredSummary,
      });
    }

    if (!options.allowFileParts && message.role === 'user' && hasUserImageParts(message)) {
      nextParts.push({
        type: 'text',
        text:
          createVisualHintText(message) ||
          '用户提供了图片视觉参考。当前主模型无法直接读取原图，请优先结合后续视觉摘要与设计系统规范继续处理。',
      });
    }

    return {
      ...message,
      parts: nextParts,
    };
  });
}

function summarizeStructuredPagePartsForAgent(message: Pick<ChatUIMessage, 'parts'>) {
  const pageParts = extractRenderableStructuredPageParts(message);
  if (pageParts.length === 0) {
    return '';
  }

  return pageParts
    .map((pagePart) => {
      const actions =
        pagePart.actions.length > 0
          ? pagePart.actions.map((action) => `${action.action}:${action.id}`).join('，')
          : '仅更新页面信息';
      return `页面 ${pagePart.artifact.name}（${pagePart.artifact.title}）：${actions}`;
    })
    .join('\n');
}
