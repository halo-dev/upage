import { describe, expect, it } from 'vitest';
import type { ChatUIMessage, UserPageSnapshot } from '~/types/message';
import type { PageData } from '~/types/pages';
import { mergePageSnapshotPages, resolvePageContextMessage } from './page-builder-context';

describe('page-builder helpers', () => {
  it('should resolve the latest assistant message as page context baseline', () => {
    const messages: Pick<ChatUIMessage, 'id' | 'role'>[] = [
      { id: 'user-1', role: 'user' },
      { id: 'assistant-1', role: 'assistant' },
      { id: 'user-2', role: 'user' },
    ];

    expect(resolvePageContextMessage(messages)?.id).toBe('assistant-1');
  });

  it('should merge local page snapshot into persisted pages', () => {
    const persistedPages: PageData[] = [
      {
        id: 'page-index',
        messageId: 'assistant-1',
        name: 'index',
        title: '首页',
        content: '<main id="main">old</main>',
        actionIds: ['hero-old'],
        sort: 0,
      },
    ];
    const snapshot: UserPageSnapshot = {
      pages: [
        {
          id: 'page-index',
          name: 'index',
          title: '首页',
          content: '<main id="main">rewound</main>',
          actionIds: ['hero-new'],
          sort: 0,
        },
      ],
      actions: [],
    };

    const mergedPages = mergePageSnapshotPages(persistedPages, snapshot, 'assistant-1');

    expect(mergedPages).toHaveLength(1);
    expect(mergedPages[0]).toMatchObject({
      messageId: 'assistant-1',
      name: 'index',
      content: '<main id="main">rewound</main>',
      actionIds: ['hero-new'],
    });
  });

  it('should use snapshot-only pages when persisted pages are unavailable', () => {
    const snapshot: UserPageSnapshot = {
      pages: [
        {
          id: 'page-pricing',
          name: 'pricing',
          title: '价格页',
          content: '<main id="pricing">pricing</main>',
          actionIds: ['pricing-hero'],
          sort: 1,
        },
      ],
      actions: [],
    };

    const mergedPages = mergePageSnapshotPages([], snapshot, 'assistant-2');

    expect(mergedPages).toEqual([
      expect.objectContaining({
        messageId: 'assistant-2',
        name: 'pricing',
        title: '价格页',
        actionIds: ['pricing-hero'],
      }),
    ]);
  });

  it('should ignore snapshot pages without a valid page name', () => {
    const persistedPages: PageData[] = [
      {
        id: 'page-index',
        messageId: 'assistant-1',
        name: 'index',
        title: '首页',
        content: '<main id="main">old</main>',
        actionIds: ['hero-old'],
        sort: 0,
      },
    ];
    const snapshot: UserPageSnapshot = {
      pages: [
        {
          id: 'invalid-page',
          name: '',
          title: '空页面',
          content: '<main id="invalid">invalid</main>',
          actionIds: ['invalid-action'],
          sort: 1,
        },
      ],
      actions: [],
    };

    const mergedPages = mergePageSnapshotPages(persistedPages, snapshot, 'assistant-1');

    expect(mergedPages).toHaveLength(1);
    expect(mergedPages[0]?.name).toBe('index');
  });
});
