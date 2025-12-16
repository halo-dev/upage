import { useCallback, useRef, useState } from 'react';
import { StreamingMessageParser } from '~/.client/runtime/message-parser';
import { webBuilderStore } from '~/.client/stores/web-builder';
import { createScopedLogger } from '~/.client/utils/logger';
import type { UPageUIMessage } from '~/types/message';

const logger = createScopedLogger('useMessageParser');

const chatStore = webBuilderStore.chatStore;
const messageParser = new StreamingMessageParser({
  callbacks: {
    onArtifactOpen: (data) => {
      logger.trace('onArtifactOpen', data);

      webBuilderStore.showWorkbench.set(true);
      chatStore.addArtifact(data);
      chatStore.setCurrentMessageId(data.messageId);
    },
    onArtifactClose: (data) => {
      logger.trace('onArtifactClose');

      chatStore.updateArtifact(data, { closed: true });
    },
    onActionOpen: (data) => {
      logger.trace('onActionOpen', data.action);
      chatStore.addAction(data);
    },
    onActionStream: (data) => {
      logger.trace('onActionStream', data.action);
      chatStore.runAction(data, true);
    },
    onActionClose: (data) => {
      logger.trace('onActionClose', data.action);
      chatStore.addAction(data);
      chatStore.runAction(data);
    },
  },
});
const extractTextContent = (message: UPageUIMessage) =>
  message.parts
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n');

export function useMessageParser() {
  const [parsedMessages, setParsedMessages] = useState<{ [key: number]: string }>({});
  const messageIdMap = useRef<Map<number, string>>(new Map());

  const parseMessages = useCallback((messages: UPageUIMessage[], isLoading: boolean) => {
    let reset = false;

    if (import.meta.env.DEV && !isLoading) {
      reset = true;
      messageParser.reset();
    }

    for (const [index, message] of messages.entries()) {
      if (message.role === 'assistant' || message.role === 'user') {
        if (!messageIdMap.current.has(index)) {
          messageIdMap.current.set(index, message.id);
        }
        // 当对应位置的 message id 发生变化时，重置解析
        if (messageIdMap.current.get(index) !== message.id) {
          reset = true;
          messageParser.reset();
          messageIdMap.current.set(index, message.id);
        }

        try {
          const textContent = extractTextContent(message);
          // 检查消息内容是否存在
          if (textContent === undefined || textContent === null) {
            logger.warn(`消息 ${message.id} 没有文本内容`);
            continue;
          }

          // 解析消息内容
          const newParsedContent = messageParser.parse(message.id, textContent);
          if (!newParsedContent) {
            continue;
          }

          // 更新解析后的消息
          setParsedMessages((prevParsed) => {
            const updatedContent = !reset ? (prevParsed[index] || '') + newParsedContent : newParsedContent;
            return {
              ...prevParsed,
              [index]: updatedContent,
            };
          });
        } catch (error) {
          // 捕获并记录解析过程中的错误
          const errorMessage = error instanceof Error ? error.message : '未知错误';
          logger.error(`解析消息 ${message.id} 失败: ${errorMessage}`);

          // 出错时保留原始消息内容
          setParsedMessages((prevParsed) => ({
            ...prevParsed,
            [index]: extractTextContent(message),
          }));
        }
      }
    }
  }, []);

  return { parsedMessages, parseMessages };
}
