import type { UIMessagePart } from 'ai';
import type {
  ChatUIMessage,
  SummaryAnnotation,
  UPageDataParts,
  UPageMessageMetadata,
  UPageProtocolVersion,
} from '~/types/message-protocol';
import type { PageBuilderUITools } from '~/types/page-builder-tools';
import { parseLegacyAssistantMessage } from '~/utils/upage-legacy';

export function normalizeMessageMetadata(metadata: unknown): UPageMessageMetadata {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata as UPageMessageMetadata;
  }

  return {};
}

export function ensureProtocolVersion(metadata: unknown, protocolVersion: UPageProtocolVersion): UPageMessageMetadata {
  return {
    ...normalizeMessageMetadata(metadata),
    protocolVersion,
  };
}

export function shouldUpgradeLegacyXmlTextMessage(message: Pick<ChatUIMessage, 'role' | 'parts'>): boolean {
  if (message.role !== 'assistant') {
    return false;
  }

  const hasStructuredPageParts = (message.parts || []).some(
    (part) => part.type === 'data-upage-page' || part.type === 'tool-upage',
  );
  if (hasStructuredPageParts) {
    return false;
  }

  const parsed = parseLegacyAssistantMessage(
    message.parts
      .filter((part): part is Extract<(typeof message.parts)[number], { type: 'text' }> => part.type === 'text')
      .map((part) => part.text)
      .join('\n'),
  );

  return parsed.pages.length > 0;
}

export function isLegacyXmlMessage(message: Pick<ChatUIMessage, 'role' | 'parts' | 'metadata'>): boolean {
  return (
    (message.role === 'assistant' && message.metadata?.protocolVersion === 'legacy-xml') ||
    shouldUpgradeLegacyXmlTextMessage(message)
  );
}

export function upgradeLegacyMessageToStructuredParts(message: ChatUIMessage): ChatUIMessage {
  if (message.metadata?.protocolVersion !== 'legacy-xml' && !shouldUpgradeLegacyXmlTextMessage(message)) {
    return message;
  }

  if (message.role !== 'assistant') {
    return {
      ...message,
      metadata: ensureProtocolVersion(message.metadata, 'structured-parts-v2'),
    };
  }

  const textParts = message.parts.filter(
    (part): part is Extract<(typeof message.parts)[number], { type: 'text' }> => part.type === 'text',
  );
  const nonTextParts = message.parts.filter((part) => part.type !== 'text');
  const parsed = parseLegacyAssistantMessage(textParts.map((part) => part.text).join('\n'));
  const nextParts: UIMessagePart<UPageDataParts, PageBuilderUITools>[] = [];

  if (parsed.text.trim()) {
    nextParts.push({
      type: 'text',
      text: parsed.text.trim(),
    });
  }

  nextParts.push(...nonTextParts);
  nextParts.push(
    ...parsed.pages.map((page) => {
      return {
        type: 'data-upage-page' as const,
        data: page,
      };
    }),
  );

  return {
    ...message,
    parts: nextParts,
    metadata: ensureProtocolVersion(message.metadata, 'structured-parts-v2'),
  };
}

export function upgradeLegacyMessagesForContinuation(messages: ChatUIMessage[]): ChatUIMessage[] {
  return messages.map(upgradeLegacyMessageToStructuredParts);
}

export function getMessagePlainTextContent(message: Pick<ChatUIMessage, 'role' | 'parts'>): string {
  return (message.parts || [])
    .map((part) => {
      if (part.type === 'text' || part.type === 'reasoning') {
        return part.text;
      }

      return '';
    })
    .filter(Boolean)
    .join('\n')
    .trim();
}

export function createSummaryPart(annotation: SummaryAnnotation) {
  return {
    type: 'data-summary' as const,
    data: annotation,
  };
}
