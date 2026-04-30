import type { LanguageModelUsage, UIMessage, UIMessagePart } from 'ai';
import { Tiktoken } from 'js-tiktoken/lite';
import o200k_base from 'js-tiktoken/ranks/o200k_base';
import { extractStructuredPageParts } from '~/utils/message-parts';

const tiktoken = new Tiktoken(o200k_base);

export type TokenUsageSnapshot = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  reasoningTokens: number;
  cachedInputTokens: number;
};

export function encode(text: string) {
  return tiktoken.encode(text);
}

export function decode(tokens: number[]) {
  return tiktoken.decode(tokens);
}

export function approximatePromptTokenCount(messages: UIMessage[]): number {
  return messages.reduce((acc, message) => {
    return acc + approximateUsageFromContent(message.parts || []);
  }, 0);
}

export function createEmptyTokenUsage(): TokenUsageSnapshot {
  return {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    reasoningTokens: 0,
    cachedInputTokens: 0,
  };
}

export function normalizeUsageSnapshot(
  usage?: Partial<TokenUsageSnapshot> | LanguageModelUsage,
): Partial<TokenUsageSnapshot> {
  if (!usage) {
    return {};
  }

  const usageWithDetails = usage as LanguageModelUsage;
  return {
    inputTokens: usage.inputTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
    totalTokens: usage.totalTokens ?? 0,
    reasoningTokens: usage.reasoningTokens ?? usageWithDetails.outputTokenDetails?.reasoningTokens ?? 0,
    cachedInputTokens: usage.cachedInputTokens ?? usageWithDetails.inputTokenDetails?.cacheReadTokens ?? 0,
  };
}

export function accumulateUsageSnapshot(
  target: TokenUsageSnapshot,
  usage?: Partial<TokenUsageSnapshot> | LanguageModelUsage,
) {
  const normalized = normalizeUsageSnapshot(usage);
  target.inputTokens += normalized.inputTokens || 0;
  target.outputTokens += normalized.outputTokens || 0;
  target.totalTokens += normalized.totalTokens || 0;
  target.reasoningTokens += normalized.reasoningTokens || 0;
  target.cachedInputTokens += normalized.cachedInputTokens || 0;
}

export function approximateSerializedTokenCount(value: unknown): number {
  if (value === undefined || value === null) {
    return 0;
  }

  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  return serialized ? encode(serialized).length : 0;
}

export function approximateReasoningTokensFromContent(parts: Array<UIMessagePart<any, any>>): number {
  return parts.reduce((total, part) => {
    if (part.type !== 'reasoning') {
      return total;
    }

    return total + encode(part.text).length;
  }, 0);
}

export function estimateTextStreamAbortUsage({
  system,
  prompt,
  streamedText,
}: {
  system?: string;
  prompt?: string;
  streamedText?: string;
}): TokenUsageSnapshot {
  const inputTokens = approximateSerializedTokenCount(system) + approximateSerializedTokenCount(prompt);
  const outputTokens = streamedText ? encode(streamedText).length : 0;

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    reasoningTokens: 0,
    cachedInputTokens: 0,
  };
}

export function estimateAgentStepAbortUsage({
  system,
  messages,
  responseParts,
}: {
  system?: string;
  messages?: unknown;
  responseParts?: Array<UIMessagePart<any, any>>;
}): TokenUsageSnapshot {
  const parts = responseParts || [];
  const inputTokens = approximateSerializedTokenCount(system) + approximateSerializedTokenCount(messages);
  const outputTokens = approximateUsageFromContent(parts);
  const reasoningTokens = approximateReasoningTokensFromContent(parts);

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    reasoningTokens,
    cachedInputTokens: 0,
  };
}

export function approximateUsageFromContent(parts: Array<UIMessagePart<any, any>>): number {
  let totalLength = 0;
  const structuredPages = extractStructuredPageParts({
    parts: parts as any,
  });
  let countedStructuredPages = false;

  for (const part of parts) {
    if (part.type === 'text') {
      totalLength += encode(part.text).length;
    }

    if (part.type === 'reasoning') {
      totalLength += encode(part.text).length;
    }
  }

  if (!countedStructuredPages && structuredPages.length > 0) {
    countedStructuredPages = true;
    totalLength += encode(
      JSON.stringify(
        structuredPages.map((pagePart) => ({
          artifact: pagePart.artifact,
          actions: pagePart.actions.map((action) => ({
            id: action.id,
            action: action.action,
            pageName: action.pageName,
            domId: action.domId,
            rootDomId: action.rootDomId,
            sort: action.sort,
            contentLength: action.content.length,
          })),
          summary: pagePart.summary,
        })),
      ),
    ).length;
  }

  return totalLength;
}
