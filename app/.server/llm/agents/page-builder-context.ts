import type { ChatUIMessage, UserPageSnapshot } from '~/types/message';
import type { PageData } from '~/types/pages';

export function resolvePageContextMessage(messages: Pick<ChatUIMessage, 'id' | 'role'>[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === 'assistant') {
      return message;
    }
  }

  return undefined;
}

export function mergePageSnapshotPages(
  basePages: PageData[],
  snapshot?: UserPageSnapshot,
  fallbackMessageId?: string,
): PageData[] {
  const mergedPages = new Map(
    basePages.filter((page) => isValidPageName(page.name)).map((page) => [page.name, page] as const),
  );

  for (const snapshotPage of snapshot?.pages || []) {
    if (!isValidPageName(snapshotPage.name)) {
      continue;
    }

    const existingPage = mergedPages.get(snapshotPage.name);
    mergedPages.set(snapshotPage.name, {
      ...existingPage,
      ...snapshotPage,
      messageId: existingPage?.messageId || fallbackMessageId || '',
      assets: existingPage?.assets,
    });
  }

  return [...mergedPages.values()].sort((left, right) => {
    return (left.sort ?? 0) - (right.sort ?? 0);
  });
}

function isValidPageName(pageName: string | undefined | null) {
  return typeof pageName === 'string' && pageName.trim().length > 0;
}
