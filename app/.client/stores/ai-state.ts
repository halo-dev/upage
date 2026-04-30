import { map } from 'nanostores';
import type { ChatRequestPhase } from '~/types/message';

export type UIState = {
  // 是否显示聊天
  showChat: boolean;
};

export type AiState = {
  // 聊天是否已经开始
  chatStarted: boolean;
  // 是否正在流式传输
  isStreaming: boolean;
  // 当前请求阶段
  requestPhase: ChatRequestPhase;
  // 是否已经初始化
  isInitialized: boolean;
  // 是否中止聊天
  aborted: boolean;
  // 当前的聊天 ID
  chatId: string | undefined;
  // 用户选择或 AI 生成的设计系统规范（DESIGN.md 格式）
  designMd: string | undefined;
  // 当前设计系统的显示名称（如 "Zapier"、"Airbnb"）
  designBrand: string | undefined;
  // 用户主动移除了设计系统，此标志为 true 时禁止服务端推送覆盖
  designMdUserRemoved: boolean;
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
  requestPhase: 'idle',
  chatId: undefined,
  isInitialized: false,
  aborted: false,
  showChat: true,
  designMd: undefined,
  designBrand: undefined,
  designMdUserRemoved: false,
});

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

export function setRequestPhase(phase: ChatRequestPhase) {
  aiState.setKey('requestPhase', phase);
}

export function getRequestPhase(): ChatRequestPhase {
  return aiState.get().requestPhase;
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

export function setDesignMd(designMd: string | undefined) {
  aiState.setKey('designMd', designMd);
}

export function getDesignMd(): string | undefined {
  return aiState.get().designMd;
}

export function setDesignSystem(content: string, brand: string) {
  aiState.set({ ...aiState.get(), designMd: content, designBrand: brand, designMdUserRemoved: false });
}

export function clearDesignSystem() {
  aiState.set({ ...aiState.get(), designMd: undefined, designBrand: undefined, designMdUserRemoved: false });
}

export function removeDesignSystem() {
  aiState.set({ ...aiState.get(), designMd: undefined, designBrand: undefined, designMdUserRemoved: true });
}

export function isDesignMdUserRemoved(): boolean {
  return aiState.get().designMdUserRemoved;
}
