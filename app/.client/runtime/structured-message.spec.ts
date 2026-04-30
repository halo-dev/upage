import { describe, expect, it, vi } from 'vitest';
import type { ChatUIMessage } from '~/types/message';
import { getStructuredPageParts, replayStructuredPageParts } from './structured-message';

describe('structured-message', () => {
  it('should extract structured page parts from assistant messages', () => {
    const message = createStructuredMessage();

    const pageParts = getStructuredPageParts(message);

    expect(pageParts).toHaveLength(1);
    expect(pageParts[0]?.artifact.name).toBe('index');
    expect(pageParts[0]?.actions).toHaveLength(1);
  });

  it('should replay structured page parts in artifact -> action -> close order', () => {
    const message = createStructuredMessage();
    const onArtifactOpen = vi.fn();
    const onAction = vi.fn();
    const onArtifactClose = vi.fn();

    replayStructuredPageParts(message, {
      onArtifactOpen,
      onAction,
      onArtifactClose,
    });

    expect(onArtifactOpen).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onArtifactClose).toHaveBeenCalledTimes(1);
    expect(onArtifactOpen.mock.invocationCallOrder[0]).toBeLessThan(onAction.mock.invocationCallOrder[0]);
    expect(onAction.mock.invocationCallOrder[0]).toBeLessThan(onArtifactClose.mock.invocationCallOrder[0]);
  });

  it('should extract structured page parts from tool-upage output', () => {
    const message = createToolStructuredMessage();

    const pageParts = getStructuredPageParts(message);

    expect(pageParts).toHaveLength(1);
    expect(pageParts[0]?.artifact.name).toBe('pricing');
    expect(pageParts[0]?.actions[0]?.id).toBe('pricing-hero');
  });

  it('should fall back to completed tool-upage input pages when output pages are missing', () => {
    const message: ChatUIMessage = {
      id: 'assistant-message-output-fallback',
      role: 'assistant',
      parts: [
        {
          type: 'tool-upage',
          toolCallId: 'tool-upage-output-fallback',
          state: 'output-available',
          input: {
            pages: [
              {
                artifact: {
                  id: 'pricing-page',
                  name: 'pricing',
                  title: '价格页',
                },
                actions: [
                  {
                    id: 'pricing-hero',
                    action: 'add',
                    pageName: 'pricing',
                    content: '<section id="pricing-hero"></section>',
                    domId: 'page-pricing',
                    rootDomId: 'pricing-hero',
                    validRootDomId: true,
                  },
                ],
              },
            ],
          },
          output: {
            pages: [],
            emittedPages: ['pricing'],
            pageCount: 1,
          },
        },
      ],
    };

    const pageParts = getStructuredPageParts(message);

    expect(pageParts).toHaveLength(1);
    expect(pageParts[0]?.artifact.name).toBe('pricing');
    expect(pageParts[0]?.actions[0]?.id).toBe('pricing-hero');
  });

  it('should extract structured page parts from tool-upage input before execution completes', () => {
    const message = createRunningToolStructuredMessage();

    const pageParts = getStructuredPageParts(message);

    expect(pageParts).toHaveLength(1);
    expect(pageParts[0]?.artifact.name).toBe('contact');
    expect(pageParts[0]?.actions[0]?.id).toBe('contact-form');
  });

  it('should extract structured page parts from tool-upage input while it is still streaming', () => {
    const message = createStreamingToolStructuredMessage();

    const pageParts = getStructuredPageParts(message);

    expect(pageParts).toHaveLength(1);
    expect(pageParts[0]?.artifact.name).toBe('about');
    expect(pageParts[0]?.actions[0]?.id).toBe('about-hero');
  });

  it('should prefer tool-upage pages over legacy data-upage-page parts', () => {
    const message: ChatUIMessage = {
      id: 'assistant-message-4',
      role: 'assistant',
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
        ...createToolStructuredMessage().parts,
      ],
    };

    const pageParts = getStructuredPageParts(message);

    expect(pageParts).toHaveLength(1);
    expect(pageParts[0]?.artifact.name).toBe('pricing');
  });

  it('should preserve repeated tool-upage page fragments in order', () => {
    const message: ChatUIMessage = {
      id: 'assistant-message-5',
      role: 'assistant',
      parts: [
        {
          type: 'tool-upage',
          toolCallId: 'tool-upage-4',
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
                    domId: 'page-index',
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
          toolCallId: 'tool-upage-5',
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
                    domId: 'page-index',
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

    const pageParts = getStructuredPageParts(message);

    expect(pageParts).toHaveLength(2);
    expect(pageParts[0]?.artifact.id).toBe('index-page-a');
    expect(pageParts[0]?.actions.map((action) => action.id)).toEqual(['header']);
    expect(pageParts[1]?.artifact.id).toBe('index-page-b');
    expect(pageParts[1]?.actions.map((action) => action.id)).toEqual(['hero']);
  });
});

function createStructuredMessage(): ChatUIMessage {
  return {
    id: 'assistant-message-1',
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
              id: 'home-hero',
              action: 'add',
              pageName: 'index',
              content: '<section id="hero-root"><h1 id="hero-title">Hello</h1></section>',
              domId: 'page-index',
              rootDomId: 'hero-root',
              sort: 0,
              validRootDomId: true,
            },
          ],
        },
      },
    ],
  };
}

function createToolStructuredMessage(): ChatUIMessage {
  return {
    id: 'assistant-message-2',
    role: 'assistant',
    parts: [
      {
        type: 'tool-upage',
        toolCallId: 'tool-upage-1',
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
                  id: 'pricing-hero',
                  action: 'update',
                  pageName: 'pricing',
                  content: '<section id="pricing-hero"></section>',
                  domId: 'page-pricing',
                  rootDomId: 'pricing-hero',
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
}

function createRunningToolStructuredMessage(): ChatUIMessage {
  return {
    id: 'assistant-message-3',
    role: 'assistant',
    parts: [
      {
        type: 'tool-upage',
        toolCallId: 'tool-upage-2',
        state: 'input-available',
        input: {
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
                  content: '<section id="contact-form"></section>',
                  domId: 'page-contact',
                  rootDomId: 'contact-form',
                  validRootDomId: true,
                },
              ],
            },
          ],
        },
      },
    ],
  };
}

function createStreamingToolStructuredMessage(): ChatUIMessage {
  return {
    id: 'assistant-message-4',
    role: 'assistant',
    parts: [
      {
        type: 'tool-upage',
        toolCallId: 'tool-upage-3',
        state: 'input-streaming',
        input: {
          pages: [
            {
              artifact: {
                id: 'about-page',
                name: 'about',
                title: '关于页',
              },
              actions: [
                {
                  id: 'about-hero',
                  action: 'add',
                  pageName: 'about',
                  content: '<section id="about-hero"></section>',
                  domId: 'page-about',
                  rootDomId: 'about-hero',
                  validRootDomId: true,
                },
              ],
            },
          ],
        },
      },
    ],
  };
}
