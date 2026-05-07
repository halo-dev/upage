export const DEFAULT_CHAT_DESCRIPTION = '未命名聊天';
export const LEGACY_UNTITLED_PAGE_TITLE = '未命名页面';

const UNTITLED_CHAT_DESCRIPTIONS = new Set([DEFAULT_CHAT_DESCRIPTION, LEGACY_UNTITLED_PAGE_TITLE]);

export function isUntitledChatDescription(value?: string | null) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized.length === 0 || UNTITLED_CHAT_DESCRIPTIONS.has(normalized);
}

export function resolveChatDescription(value?: string | null) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!normalized || normalized === LEGACY_UNTITLED_PAGE_TITLE) {
    return DEFAULT_CHAT_DESCRIPTION;
  }

  return normalized;
}

export function shouldUsePageTitleAsChatDescription(currentDescription?: string | null, pageTitle?: string | null) {
  const normalizedPageTitle = typeof pageTitle === 'string' ? pageTitle.trim() : '';
  if (!normalizedPageTitle || normalizedPageTitle === LEGACY_UNTITLED_PAGE_TITLE) {
    return false;
  }

  return isUntitledChatDescription(currentDescription);
}
