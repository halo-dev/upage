import { useCallback, useMemo, useRef, useState } from 'react';
import { StreamingMessageParser } from '~/.client/runtime/message-parser';
import { PageChangeCoordinator } from '~/.client/runtime/page-change-coordinator';
import { normalizeStructuredPageEvents } from '~/.client/runtime/protocol/normalize-page-events';
import { webBuilderStore } from '~/.client/stores/web-builder';
import { createScopedLogger } from '~/.client/utils/logger';
import type { ChatUIMessage } from '~/types/message';

const logger = createScopedLogger('useMessageParser');

const chatStore = webBuilderStore.chatStore;
const extractTextContent = (message: ChatUIMessage) =>
  message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n');

export function useMessageParser() {
  const [renderedTexts, setRenderedTexts] = useState<Record<string, string>>({});
  const renderedTextsRef = useRef<Record<string, string>>({});
  const previousMessageIdsRef = useRef<string[]>([]);
  const coordinator = useMemo(() => new PageChangeCoordinator(webBuilderStore), []);
  const messageParser = useMemo(
    () =>
      new StreamingMessageParser({
        callbacks: {
          onArtifactOpen: (data) => {
            logger.trace('onArtifactOpen', data);
            coordinator.handleArtifactOpen(data);
          },
          onArtifactClose: (data) => {
            logger.trace('onArtifactClose');
            coordinator.handleArtifactClose(data);
          },
          onActionOpen: (data) => {
            logger.trace('onActionOpen', data.action);
            chatStore.addAction(data);
          },
          onActionStream: (data) => {
            logger.trace('onActionStream', data.action);
            coordinator.handleAction(data, true);
          },
          onActionClose: (data) => {
            logger.trace('onActionClose', data.action);
            coordinator.handleAction(data);
          },
        },
      }),
    [coordinator],
  );

  const resetParser = useCallback(() => {
    previousMessageIdsRef.current = [];
    coordinator.reset();
    messageParser.reset();
    renderedTextsRef.current = {};
    setRenderedTexts({});
  }, [coordinator, messageParser]);

  const parseMessages = useCallback(
    (messages: ChatUIMessage[], isLoading: boolean) => {
      const nextMessages = messages.filter((message) => message.role === 'assistant' || message.role === 'user');
      const nextMessageIds = nextMessages.map((message) => message.id);
      const previousMessageIds = previousMessageIdsRef.current;
      const shouldReset =
        !isLoading ||
        nextMessageIds.length < previousMessageIds.length ||
        nextMessageIds.some(
          (messageId, index) => previousMessageIds[index] !== undefined && previousMessageIds[index] !== messageId,
        );

      if (shouldReset) {
        coordinator.reset();
        messageParser.reset();
      }

      const nextRenderedTexts: Record<string, string> = shouldReset ? {} : { ...renderedTextsRef.current };

      for (const message of nextMessages) {
        const structuredEvents = normalizeStructuredPageEvents(message);
        if (structuredEvents.length > 0) {
          coordinator.handleEvents(structuredEvents);
          delete nextRenderedTexts[message.id];
          continue;
        }

        try {
          const textContent = extractTextContent(message);
          if (textContent === undefined || textContent === null) {
            logger.warn(`消息 ${message.id} 没有文本内容`);
            continue;
          }

          const newParsedContent = messageParser.parse(message.id, textContent);
          if (!newParsedContent && nextRenderedTexts[message.id] !== undefined) {
            continue;
          }

          nextRenderedTexts[message.id] = shouldReset
            ? newParsedContent || textContent
            : (nextRenderedTexts[message.id] || '') + (newParsedContent || '');
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '未知错误';
          logger.error(`解析消息 ${message.id} 失败: ${errorMessage}`);
          nextRenderedTexts[message.id] = extractTextContent(message);
        }
      }

      previousMessageIdsRef.current = nextMessageIds;
      renderedTextsRef.current = nextRenderedTexts;
      setRenderedTexts(nextRenderedTexts);
    },
    [coordinator, messageParser],
  );

  return { renderedTexts, parseMessages, resetParser };
}
