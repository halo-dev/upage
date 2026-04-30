import { describe, expect, it } from 'vitest';
import type { ChatUIMessage } from '~/types/message';
import { normalizeStructuredPageEvents } from './normalize-page-events';

describe('normalizeStructuredPageEvents', () => {
  it('should emit streaming placeholder events for block start parts', () => {
    const message: ChatUIMessage = {
      id: 'assistant-message-block-start',
      role: 'assistant',
      parts: [
        {
          type: 'data-upage-block-start',
          data: {
            artifact: {
              id: 'avatar-page',
              name: 'index',
              title: '头像卡片展示',
            },
            action: {
              id: 'avatar-card-section',
              action: 'add',
              pageName: 'index',
              content: '',
              domId: 'main',
              rootDomId: 'avatar-card-section',
              validRootDomId: false,
            },
            sequence: 1,
          },
        },
      ],
    };

    const events = normalizeStructuredPageEvents(message);

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      type: 'artifact-open',
      source: 'data-upage-block-start',
    });
    expect(events[1]).toMatchObject({
      type: 'action',
      source: 'data-upage-block-start',
      streaming: true,
      actionId: 'avatar-card-section',
    });
  });

  it('should keep tool-upage input events in streaming mode until output is available', () => {
    const message: ChatUIMessage = {
      id: 'assistant-message-streaming',
      role: 'assistant',
      parts: [
        {
          type: 'tool-upage',
          toolCallId: 'tool-upage-streaming',
          state: 'input-streaming',
          input: {
            pages: [
              {
                artifact: {
                  id: 'avatar-page',
                  name: 'index',
                  title: '头像卡片展示',
                },
                actions: [
                  {
                    id: 'avatar-card-section',
                    action: 'add',
                    pageName: 'index',
                    content: '<section id="avatar-card-section"></section>',
                    domId: 'main',
                    rootDomId: 'avatar-card-section',
                    validRootDomId: true,
                  },
                ],
              },
            ],
          },
        },
      ],
    };

    const events = normalizeStructuredPageEvents(message);

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      type: 'artifact-open',
      messageId: 'assistant-message-streaming',
      source: 'tool-upage-input',
      artifact: {
        id: 'avatar-page',
        name: 'index',
        title: '头像卡片展示',
      },
    });
    expect(events[1]).toMatchObject({
      type: 'action',
      messageId: 'assistant-message-streaming',
      artifactId: 'avatar-page',
      actionId: 'avatar-card-section',
      source: 'tool-upage-input',
      streaming: true,
    });
  });

  it('should mark tool-upage output events as completed and close the artifact', () => {
    const message: ChatUIMessage = {
      id: 'assistant-message-completed',
      role: 'assistant',
      parts: [
        {
          type: 'tool-upage',
          toolCallId: 'tool-upage-completed',
          state: 'output-available',
          input: {
            pages: [],
          },
          output: {
            pages: [
              {
                artifact: {
                  id: 'avatar-page',
                  name: 'index',
                  title: '头像卡片展示',
                },
                actions: [
                  {
                    id: 'avatar-card-section',
                    action: 'add',
                    pageName: 'index',
                    content: '<section id="avatar-card-section"></section>',
                    domId: 'main',
                    rootDomId: 'avatar-card-section',
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
    };

    const events = normalizeStructuredPageEvents(message);

    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({
      type: 'artifact-open',
      source: 'tool-upage-output',
    });
    expect(events[1]).toMatchObject({
      type: 'action',
      source: 'tool-upage-output',
      streaming: false,
    });
    expect(events[2]).toMatchObject({
      type: 'artifact-close',
      source: 'tool-upage-output',
    });
  });

  it('should fall back to tool-upage input pages when completed output pages are missing', () => {
    const message: ChatUIMessage = {
      id: 'assistant-message-completed-fallback',
      role: 'assistant',
      parts: [
        {
          type: 'tool-upage',
          toolCallId: 'tool-upage-completed-fallback',
          state: 'output-available',
          input: {
            pages: [
              {
                artifact: {
                  id: 'avatar-page',
                  name: 'index',
                  title: '头像卡片展示',
                },
                actions: [
                  {
                    id: 'avatar-card-section',
                    action: 'add',
                    pageName: 'index',
                    content: '<section id="avatar-card-section"></section>',
                    domId: 'main',
                    rootDomId: 'avatar-card-section',
                    validRootDomId: true,
                  },
                ],
              },
            ],
          },
          output: {
            pages: [],
            emittedPages: ['index'],
            pageCount: 1,
          },
        },
      ],
    };

    const events = normalizeStructuredPageEvents(message);

    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({
      type: 'artifact-open',
      source: 'tool-upage-output',
    });
    expect(events[1]).toMatchObject({
      type: 'action',
      source: 'tool-upage-output',
      streaming: false,
      action: {
        rootDomId: 'avatar-card-section',
      },
    });
    expect(events[2]).toMatchObject({
      type: 'artifact-close',
      source: 'tool-upage-output',
    });
  });

  it('should tolerate partial tool-upage input before root ids are finalized', () => {
    const message = {
      id: 'assistant-message-partial-input',
      role: 'assistant',
      parts: [
        {
          type: 'tool-upage',
          toolCallId: 'tool-upage-partial',
          state: 'input-streaming',
          input: {
            pages: [
              {
                artifact: {
                  id: 'avatar-page',
                  name: 'index',
                  title: '头像卡片展示',
                },
                actions: [
                  {
                    id: 'avatar-card-section',
                    action: 'add',
                    pageName: 'index',
                    content: '<section id="avatar-card-section">',
                  },
                ],
              },
            ],
          },
        },
      ],
    } as unknown as ChatUIMessage;

    const events = normalizeStructuredPageEvents(message);

    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({
      type: 'action',
      source: 'tool-upage-input',
      streaming: true,
      action: {
        domId: 'main',
        rootDomId: 'avatar-card-section',
        validRootDomId: false,
      },
    });
  });

  it('should emit separate event groups for repeated page fragments', () => {
    const message: ChatUIMessage = {
      id: 'assistant-message-repeated-page-fragments',
      role: 'assistant',
      parts: [
        {
          type: 'tool-upage',
          toolCallId: 'tool-upage-fragment-1',
          state: 'output-available',
          input: {
            pages: [],
          },
          output: {
            pages: [
              {
                artifact: {
                  id: 'index-page-a',
                  name: 'index',
                  title: '首页',
                },
                actions: [
                  {
                    id: 'header',
                    action: 'add',
                    pageName: 'index',
                    content: '<header id="header"></header>',
                    domId: 'main',
                    rootDomId: 'header',
                    validRootDomId: true,
                  },
                ],
              },
            ],
            emittedPages: ['index'],
            pageCount: 1,
          },
        },
        {
          type: 'tool-upage',
          toolCallId: 'tool-upage-fragment-2',
          state: 'output-available',
          input: {
            pages: [],
          },
          output: {
            pages: [
              {
                artifact: {
                  id: 'index-page-b',
                  name: 'index',
                  title: '首页',
                },
                actions: [
                  {
                    id: 'hero',
                    action: 'add',
                    pageName: 'index',
                    content: '<section id="hero"></section>',
                    domId: 'main',
                    rootDomId: 'hero',
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
    };

    const events = normalizeStructuredPageEvents(message);

    expect(events).toHaveLength(6);
    expect(events[0]).toMatchObject({ type: 'artifact-open', artifact: { id: 'index-page-a' } });
    expect(events[1]).toMatchObject({ type: 'action', artifactId: 'index-page-a', actionId: 'header' });
    expect(events[2]).toMatchObject({ type: 'artifact-close', artifact: { id: 'index-page-a' } });
    expect(events[3]).toMatchObject({ type: 'artifact-open', artifact: { id: 'index-page-b' } });
    expect(events[4]).toMatchObject({ type: 'action', artifactId: 'index-page-b', actionId: 'hero' });
    expect(events[5]).toMatchObject({ type: 'artifact-close', artifact: { id: 'index-page-b' } });
  });

  it('should preserve patch actions from tool-upage payloads', () => {
    const message: ChatUIMessage = {
      id: 'assistant-message-patch',
      role: 'assistant',
      parts: [
        {
          type: 'tool-upage',
          toolCallId: 'tool-upage-patch',
          state: 'output-available',
          input: {
            pages: [],
          },
          output: {
            pages: [
              {
                artifact: {
                  id: 'index-page',
                  name: 'index',
                  title: '首页',
                },
                actions: [
                  {
                    id: 'hero-copy',
                    action: 'update',
                    pageName: 'index',
                    contentKind: 'patch',
                    content: '',
                    domId: 'hero-copy',
                    rootDomId: 'hero-copy',
                    patches: [
                      {
                        opId: 'set-copy',
                        type: 'set-text',
                        target: {
                          domId: 'hero-copy',
                        },
                        text: '全新标题',
                      },
                    ],
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
    };

    const events = normalizeStructuredPageEvents(message);

    expect(events[1]).toMatchObject({
      type: 'action',
      action: {
        contentKind: 'patch',
        patches: [
          {
            opId: 'set-copy',
            type: 'set-text',
          },
        ],
      },
    });
  });

  it('should preserve remove-page patch actions from tool-upage payloads', () => {
    const message: ChatUIMessage = {
      id: 'assistant-message-remove-page',
      role: 'assistant',
      parts: [
        {
          type: 'tool-upage',
          toolCallId: 'tool-upage-remove-page',
          state: 'output-available',
          input: {
            pages: [],
          },
          output: {
            pages: [
              {
                artifact: {
                  id: 'pricing-page',
                  name: 'pricing',
                  title: '定价页',
                },
                actions: [
                  {
                    id: 'remove-pricing-page',
                    action: 'remove',
                    pageName: 'pricing',
                    contentKind: 'patch',
                    content: '',
                    domId: '__page__',
                    rootDomId: '__page__',
                    patches: [
                      {
                        opId: 'remove-pricing-page-op',
                        type: 'remove-page',
                      },
                    ],
                    validRootDomId: true,
                  },
                ],
              },
            ],
            emittedPages: ['pricing'],
            pageCount: 1,
          },
        },
      ],
    };

    const events = normalizeStructuredPageEvents(message);

    expect(events[1]).toMatchObject({
      type: 'action',
      action: {
        action: 'remove',
        contentKind: 'patch',
        patches: [
          {
            opId: 'remove-pricing-page-op',
            type: 'remove-page',
          },
        ],
      },
    });
  });

  it('should ignore invalid page fragments with empty page names', () => {
    const message: ChatUIMessage = {
      id: 'assistant-message-invalid-page-name',
      role: 'assistant',
      parts: [
        {
          type: 'tool-upage',
          toolCallId: 'tool-upage-invalid-page-name',
          state: 'output-available',
          input: {
            pages: [],
          },
          output: {
            pages: [
              {
                artifact: {
                  id: 'invalid-page',
                  name: '',
                  title: '首页',
                },
                actions: [
                  {
                    id: 'hero',
                    action: 'add',
                    pageName: '',
                    content: '<section id="hero"></section>',
                    domId: 'main',
                    rootDomId: 'hero',
                    validRootDomId: true,
                  },
                ],
              },
            ],
            emittedPages: [''],
            pageCount: 1,
          },
        },
      ],
    };

    const events = normalizeStructuredPageEvents(message);

    expect(events).toEqual([]);
  });
});
