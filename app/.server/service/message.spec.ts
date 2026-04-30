import { describe, expect, it, vi } from 'vitest';

vi.mock('~/.server/service/prisma', () => ({
  prisma: {},
}));

import {
  convertToUIMessage,
  createStructuredPageSummary,
  getMessagePlainTextContent,
  isLegacyXmlMessage,
  saveChatMessages,
  upgradeLegacyMessagesForContinuation,
  upgradeLegacyMessageToStructuredParts,
} from './message';

describe('message service helpers', () => {
  it('should include structured page summaries in persisted plain text content', () => {
    const content = getMessagePlainTextContent({
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: '已完成首页改版。',
        },
        {
          type: 'data-upage-page',
          data: {
            artifact: {
              id: 'home-page',
              name: 'index',
              title: '首页',
            },
            actions: [
              {
                id: 'hero-section',
                action: 'update',
                pageName: 'index',
                content: '<section id="hero-root"></section>',
                domId: 'hero-root',
                rootDomId: 'hero-root',
                validRootDomId: true,
              },
            ],
          },
        },
      ],
    });

    expect(content).toContain('已完成首页改版。');
    expect(content).toBe('已完成首页改版。');
  });

  it('should summarize structured-only messages', () => {
    const summary = createStructuredPageSummary({
      parts: [
        {
          type: 'data-upage-page',
          data: {
            artifact: {
              id: 'pricing-page',
              name: 'pricing',
              title: '定价页',
            },
            actions: [],
          },
        },
      ],
    });

    expect(summary).toBe('');
  });

  it('should summarize tool-upage output messages', () => {
    const summary = createStructuredPageSummary({
      parts: [
        {
          type: 'tool-upage',
          toolCallId: 'tool-1',
          state: 'output-available',
          input: {
            pages: [],
          },
          output: {
            pages: [
              {
                artifact: {
                  id: 'contact-page',
                  name: 'contact',
                  title: '联系页',
                },
                actions: [
                  {
                    id: 'contact-form',
                    action: 'add',
                    pageName: 'contact',
                    content: '<form id="contact-form"></form>',
                    domId: 'page-contact',
                    rootDomId: 'contact-form',
                    validRootDomId: true,
                  },
                ],
              },
            ],
            emittedPages: ['contact'],
            pageCount: 1,
          },
        },
      ],
    });

    expect(summary).toBe('');
  });

  it('should prefer tool-upage pages over duplicated data-upage-page summaries', () => {
    const summary = createStructuredPageSummary({
      parts: [
        {
          type: 'data-upage-page',
          data: {
            artifact: {
              id: 'legacy-home-page',
              name: 'legacy-home',
              title: '旧首页',
            },
            actions: [],
          },
        },
        {
          type: 'tool-upage',
          toolCallId: 'tool-2',
          state: 'output-available',
          input: {
            pages: [],
          },
          output: {
            pages: [
              {
                artifact: {
                  id: 'home-page',
                  name: 'index',
                  title: '首页',
                },
                actions: [
                  {
                    id: 'hero-section',
                    action: 'update',
                    pageName: 'index',
                    content: '<section id="hero-root"></section>',
                    domId: 'hero-root',
                    rootDomId: 'hero-root',
                    validRootDomId: true,
                  },
                ],
              },
            ],
            emittedPages: ['index'],
            pageCount: 1,
          },
        },
      ],
    });

    expect(summary).toBe('');
  });

  it('should mark structured messages with protocol version metadata', () => {
    const message = convertToUIMessage({
      id: 'assistant-1',
      chatId: 'chat-1',
      userId: 'user-1',
      role: 'assistant',
      content: 'ignored',
      revisionId: null,
      annotations: null,
      isDiscarded: false,
      metadata: null,
      parts: [
        {
          type: 'text',
          text: '结构化消息',
        },
      ],
      version: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(message.metadata?.protocolVersion).toBe('structured-parts-v2');
  });

  it('should preserve persisted parts even when version is not 2', () => {
    const message = convertToUIMessage({
      id: 'assistant-2',
      chatId: 'chat-1',
      userId: 'user-1',
      role: 'assistant',
      content: 'legacy fallback',
      revisionId: null,
      annotations: null,
      isDiscarded: false,
      metadata: null,
      parts: [
        {
          type: 'data-upage-page',
          data: {
            artifact: {
              id: 'home-page',
              name: 'index',
              title: '首页',
            },
            actions: [],
          },
        },
      ],
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(message.parts).toHaveLength(1);
    expect(message.parts[0]?.type).toBe('data-upage-page');
    expect(message.metadata?.protocolVersion).toBe('structured-parts-v2');
  });

  it('should detect assistant legacy XML messages', () => {
    const message = convertToUIMessage({
      id: 'assistant-legacy-detect',
      chatId: 'chat-1',
      userId: 'user-1',
      role: 'assistant',
      content: '<uPageArtifact id="page-1" name="index" title="首页"></uPageArtifact>',
      revisionId: null,
      annotations: null,
      isDiscarded: false,
      metadata: null,
      parts: null,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    expect(isLegacyXmlMessage(message)).toBe(true);
  });

  it('should upgrade legacy assistant XML messages to structured parts', () => {
    const message = convertToUIMessage({
      id: 'assistant-legacy-upgrade',
      chatId: 'chat-1',
      userId: 'user-1',
      role: 'assistant',
      content:
        '已完成首页改版。<uPageArtifact id="page-1" name="index" title="首页"><uPageAction id="hero-1" pageName="index" action="update" domId="hero" rootDomId="hero">hero content</uPageAction></uPageArtifact>',
      revisionId: null,
      annotations: null,
      isDiscarded: false,
      metadata: null,
      parts: null,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const upgraded = upgradeLegacyMessageToStructuredParts(message);

    expect(upgraded.metadata?.protocolVersion).toBe('structured-parts-v2');
    expect(upgraded.parts[0]).toEqual({
      type: 'text',
      text: '已完成首页改版。',
    });
    expect(upgraded.parts[1]).toEqual({
      type: 'data-upage-page',
      data: {
        artifact: {
          id: 'page-1',
          name: 'index',
          title: '首页',
        },
        actions: [
          {
            id: 'hero-1',
            action: 'update',
            pageName: 'index',
            content: 'hero content',
            domId: 'hero',
            rootDomId: 'hero',
            validRootDomId: true,
            sort: undefined,
          },
        ],
      },
    });
  });

  it('should preserve summary parts while upgrading legacy messages for continuation', () => {
    const message = convertToUIMessage({
      id: 'assistant-legacy-summary',
      chatId: 'chat-1',
      userId: 'user-1',
      role: 'assistant',
      content: '<uPageArtifact id="page-1" name="index" title="首页"></uPageArtifact>',
      revisionId: null,
      annotations: [
        {
          type: 'chatSummary',
          chatId: 'chat-1',
          summary: '历史摘要',
        },
      ],
      isDiscarded: false,
      metadata: null,
      parts: null,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const [upgraded] = upgradeLegacyMessagesForContinuation([message]);

    expect(upgraded.metadata?.protocolVersion).toBe('structured-parts-v2');
    expect(upgraded.parts.map((part) => part.type)).toEqual(['data-summary', 'data-upage-page']);
  });

  it('should revive discarded messages when saving the active rewind branch', async () => {
    const upsert = vi.fn().mockResolvedValue(undefined);
    const db = {
      chat: {
        findUnique: vi.fn().mockResolvedValue({
          userId: 'user-1',
        }),
      },
      message: {
        upsert,
      },
    } as never;

    await saveChatMessages(
      'chat-1',
      [
        {
          id: 'assistant-branch-1',
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: '第一轮分支回复',
            },
          ],
          metadata: {},
        },
      ],
      db,
    );

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          isDiscarded: false,
        }),
        create: expect.objectContaining({
          isDiscarded: false,
        }),
      }),
    );
  });
});
