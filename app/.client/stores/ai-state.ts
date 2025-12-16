import { map } from 'nanostores';
import type { UPageUIMessage } from '~/types/message';

export type ParsedUIMessage = UPageUIMessage & {
  content?: string;
};

export type UIState = {
  // 是否显示聊天
  showChat: boolean;
};

export type AiState = {
  // 聊天是否已经开始
  chatStarted: boolean;
  // 是否正在流式传输
  isStreaming: boolean;
  // 是否已经初始化
  isInitialized: boolean;
  // 是否中止聊天
  aborted: boolean;
  // 当前的聊天 ID
  chatId: string | undefined;
  // 当前聊天的消息列表，包含解析后的消息内容，仅用于前端渲染
  parseMessages: ParsedUIMessage[];
};

/**
 * AI 状态管理存储
 * 用于跟踪 AI 相关的状态信息，包括：
 * - isStreaming: 是否正在生成内容
 * - chatId: 当前的聊天 ID
 * - messageId: 当前的消息 ID
 * - chatMessages: 当前聊天的消息列表，包含解析后的消息内容，仅用于前端渲染
 */
export const aiState = map<AiState & UIState>({
  chatStarted: false,
  isStreaming: false,
  chatId: undefined,
  isInitialized: false,
  parseMessages: [],
  aborted: false,
  showChat: true,
});

/**
 * 更新聊天消息列表
 * @param messages 原始消息列表
 * @param parsedMessages 解析后的消息内容映射
 */
export function updateParseMessages(messages: UPageUIMessage[], parsedMessages: { [key: number]: string }) {
  const updatedMessages = messages.map((message, i) => {
    if (message.role === 'user') {
      return message;
    }

    return {
      ...message,
      content: parsedMessages[i] || '',
    };
  });

  aiState.setKey('parseMessages', updatedMessages);
}

/**
 * 获取当前的聊天消息列表
 * @returns 当前的聊天消息列表
 */
export function getParseMessages(): ParsedUIMessage[] {
  return aiState.get().parseMessages;
}

export function setChatStarted(chatStarted: boolean) {
  aiState.setKey('chatStarted', chatStarted);
}

export function getChatStarted(): boolean {
  return aiState.get().chatStarted;
}

/**
 * 更新 AI 的流式状态
 * @param streaming 是否正在流式传输
 */
export function setStreamingState(streaming: boolean) {
  aiState.setKey('isStreaming', streaming);
}

/**
 * 获取当前 AI 的流式状态
 * @returns 是否正在流式传输
 */
export function getStreamingState(): boolean {
  return aiState.get().isStreaming;
}

/**
 * 设置当前的聊天 ID
 * @param id 聊天 ID
 */
export function setChatId(id: string | undefined) {
  aiState.setKey('chatId', id);
}

/**
 * 获取当前的聊天 ID
 * @returns 当前的聊天 ID
 */
export function getChatId(): string | undefined {
  return aiState.get().chatId;
}

export function setShowChat(showChat: boolean) {
  aiState.setKey('showChat', showChat);
}

export function getShowChat(): boolean {
  return aiState.get().showChat;
}

export function setAborted(aborted: boolean) {
  aiState.setKey('aborted', aborted);
}

export function getAborted(): boolean {
  return aiState.get().aborted;
}
