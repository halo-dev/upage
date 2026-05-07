import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CHAT_DESCRIPTION,
  isUntitledChatDescription,
  resolveChatDescription,
  shouldUsePageTitleAsChatDescription,
} from './chat-description';

describe('chat-description', () => {
  it('should treat empty and legacy placeholder descriptions as untitled', () => {
    expect(isUntitledChatDescription('')).toBe(true);
    expect(isUntitledChatDescription('未命名页面')).toBe(true);
    expect(isUntitledChatDescription(DEFAULT_CHAT_DESCRIPTION)).toBe(true);
  });

  it('should normalize empty chat descriptions to the chat fallback', () => {
    expect(resolveChatDescription('')).toBe(DEFAULT_CHAT_DESCRIPTION);
    expect(resolveChatDescription('未命名页面')).toBe(DEFAULT_CHAT_DESCRIPTION);
    expect(resolveChatDescription('品牌官网改版')).toBe('品牌官网改版');
  });

  it('should only use meaningful page titles to replace untitled chat descriptions', () => {
    expect(shouldUsePageTitleAsChatDescription('', '首页')).toBe(true);
    expect(shouldUsePageTitleAsChatDescription('品牌官网改版', '首页')).toBe(false);
    expect(shouldUsePageTitleAsChatDescription('未命名页面', '未命名页面')).toBe(false);
  });
});
