import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChatUIMessage } from '~/types/message';
import { AssistantMessage } from './AssistantMessage';

vi.mock('./Artifact', () => {
  return {
    Artifact: ({
      messageId,
      artifactId,
      actionIds = [],
    }: {
      messageId: string;
      artifactId: string;
      actionIds?: string[];
    }) => {
      return <div data-testid="artifact-card">{`${messageId}:${artifactId}:${actionIds.join(',')}`}</div>;
    },
  };
});

describe('AssistantMessage', () => {
  it('should render legacy assistant prose from renderedText when no structured parts exist', () => {
    const message: ChatUIMessage = {
      id: 'assistant-message-legacy-text',
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: '原始 legacy XML 文本',
        },
      ],
    };

    render(<AssistantMessage message={message} renderedText="剥离标签后的展示文本" />);

    expect(screen.getByText('剥离标签后的展示文本')).toBeTruthy();
    expect(screen.queryByText('原始 legacy XML 文本')).toBeNull();
  });

  it('should render structured text and artifact cards from parts', () => {
    const message: ChatUIMessage = {
      id: 'assistant-message-1',
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: '我已经完成首页改版。',
        },
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
    };

    render(<AssistantMessage message={message} />);

    expect(screen.getByText('我已经完成首页改版。')).toBeTruthy();
    expect(screen.getByTestId('artifact-card').textContent).toBe('assistant-message-1:home-page:');
  });

  it('should group the matching reasoning and tool result inside the same step container', () => {
    const message: ChatUIMessage = {
      id: 'assistant-message-2',
      role: 'assistant',
      parts: [
        {
          type: 'reasoning',
          text: '先分析用户需求。',
        },
        {
          type: 'step-start',
        },
        {
          type: 'tool-historySummary',
          toolCallId: 'tool-history-summary-1',
          state: 'output-available',
          input: {},
          output: {
            hasHistory: false,
            summary: '',
            reused: false,
          },
        },
        {
          type: 'step-start',
        },
        {
          type: 'tool-upage',
          toolCallId: 'tool-upage-1',
          state: 'output-available',
          input: {
            pages: [],
          },
          output: {
            pages: [],
            emittedPages: ['index'],
            pageCount: 1,
          },
        },
      ],
    };

    render(<AssistantMessage message={message} />);

    const stepContainer = screen.getByTestId('step-container-1');
    expect(within(stepContainer).getByText('步骤 1')).toBeTruthy();
    expect(within(stepContainer).getByText('思考过程')).toBeTruthy();
    expect(within(stepContainer).getByText('生成历史摘要')).toBeTruthy();
  });

  it('should keep running tool-upage input as a tool status without artifact cards', () => {
    const message: ChatUIMessage = {
      id: 'assistant-message-running-tool',
      role: 'assistant',
      parts: [
        {
          type: 'tool-upage',
          toolCallId: 'tool-upage-running',
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

    render(<AssistantMessage message={message} isStreaming />);

    expect(screen.getByText('应用页面变更')).toBeTruthy();
    expect(screen.queryByTestId('artifact-card')).toBeNull();
  });

  it('should render artifact cards from completed tool-upage input when output pages are missing', () => {
    const message: ChatUIMessage = {
      id: 'assistant-message-completed-tool-fallback',
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
          output: {
            pages: [],
            emittedPages: ['contact'],
            pageCount: 1,
          },
        },
      ],
    };

    render(<AssistantMessage message={message} />);

    expect(screen.getByText('应用页面变更')).toBeTruthy();
    expect(screen.getByTestId('artifact-card').textContent).toBe(
      'assistant-message-completed-tool-fallback:contact-page:contact-form',
    );
  });

  it('should render deduped preparation timeline stages', () => {
    const message: ChatUIMessage = {
      id: 'assistant-message-preparation',
      role: 'assistant',
      parts: [
        {
          type: 'data-preparation-stage',
          data: {
            stage: 'candidate-pages',
            status: 'in-progress',
            order: 0,
            label: '相关页面筛选',
            message: '正在筛选相关页面（共 3 页）。',
          },
        },
        {
          type: 'data-preparation-stage',
          data: {
            stage: 'candidate-pages',
            status: 'complete',
            order: 1,
            label: '相关页面筛选',
            message: '已筛选 2 个相关页面。',
            selectedPages: ['index', 'pricing'],
            durationMs: 420,
          },
        },
        {
          type: 'step-start',
        },
        {
          type: 'tool-selectRelevantPages',
          toolCallId: 'tool-select-pages-preparation',
          state: 'output-available',
          input: {},
          output: {
            hasPages: true,
            selectedPages: ['index', 'pricing'],
            candidatePages: ['index', 'pricing'],
            reused: false,
            usedFallback: false,
          },
        },
      ],
    };

    render(<AssistantMessage message={message} />);

    expect(screen.getByText('上下文准备')).toBeTruthy();
    expect(screen.getByText('相关页面筛选')).toBeTruthy();
    expect(screen.getByText('页面：index、pricing')).toBeTruthy();
    expect(screen.getAllByText('相关页面筛选')).toHaveLength(1);
  });

  it('should not render preparation timeline without preparation tool parts', () => {
    const message: ChatUIMessage = {
      id: 'assistant-message-stage-only',
      role: 'assistant',
      parts: [
        {
          type: 'data-preparation-stage',
          data: {
            stage: 'history-summary',
            status: 'complete',
            order: 0,
            label: '历史摘要',
            message: '历史对话摘要已生成。',
          },
        },
      ],
    };

    render(<AssistantMessage message={message} />);

    expect(screen.queryByText('上下文准备')).toBeNull();
    expect(screen.queryByText('历史摘要')).toBeNull();
  });

  it('should hide preparation tool cards when preparation timeline is present', () => {
    const message: ChatUIMessage = {
      id: 'assistant-message-preparation-tools',
      role: 'assistant',
      parts: [
        {
          type: 'data-preparation-stage',
          data: {
            stage: 'history-summary',
            status: 'complete',
            order: 1,
            label: '历史摘要',
            message: '历史对话摘要已生成。',
          },
        },
        {
          type: 'step-start',
        },
        {
          type: 'tool-historySummary',
          toolCallId: 'tool-history-summary-1',
          state: 'output-available',
          input: {},
          output: {
            hasHistory: true,
            summary: '用户希望重做首页首屏。',
            reused: false,
          },
        },
        {
          type: 'tool-selectRelevantPages',
          toolCallId: 'tool-select-pages-1',
          state: 'output-available',
          input: {},
          output: {
            hasPages: true,
            selectedPages: ['index'],
            candidatePages: ['index'],
            reused: false,
            usedFallback: false,
          },
        },
      ],
    };

    render(<AssistantMessage message={message} />);

    expect(screen.getByText('上下文准备')).toBeTruthy();
    expect(screen.queryByText('生成历史摘要')).toBeNull();
    expect(screen.getByText('筛选相关页面')).toBeTruthy();
  });

  it('should keep preparation tool cards visible when their stage is absent from the timeline', () => {
    const message: ChatUIMessage = {
      id: 'assistant-message-sparse-preparation-tools',
      role: 'assistant',
      parts: [
        {
          type: 'data-preparation-stage',
          data: {
            stage: 'history-summary',
            status: 'complete',
            order: 1,
            label: '历史摘要',
            message: '历史对话摘要已生成。',
          },
        },
        {
          type: 'step-start',
        },
        {
          type: 'tool-historySummary',
          toolCallId: 'tool-history-summary-sparse',
          state: 'output-available',
          input: {},
          output: {
            hasHistory: true,
            summary: '用户希望重做首页首屏。',
            reused: true,
          },
        },
        {
          type: 'tool-selectRelevantPages',
          toolCallId: 'tool-select-pages-sparse',
          state: 'output-available',
          input: {},
          output: {
            hasPages: true,
            selectedPages: ['index'],
            candidatePages: ['index'],
            reused: true,
            usedFallback: false,
          },
        },
      ],
    };

    render(<AssistantMessage message={message} />);

    expect(screen.getByText('上下文准备')).toBeTruthy();
    expect(screen.queryByText('生成历史摘要')).toBeNull();
    expect(screen.getByText('筛选相关页面')).toBeTruthy();
  });

  it('should keep streaming tool-upage input as a tool status without artifact cards', () => {
    const message: ChatUIMessage = {
      id: 'assistant-message-streaming-tool',
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

    render(<AssistantMessage message={message} isStreaming />);

    expect(screen.getByText('应用页面变更')).toBeTruthy();
    expect(screen.queryByTestId('artifact-card')).toBeNull();
  });

  it('should render artifact cards as soon as block start events arrive', () => {
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

    render(<AssistantMessage message={message} isStreaming />);

    expect(screen.getByTestId('artifact-card').textContent).toBe(
      'assistant-message-block-start:avatar-page:avatar-card-section',
    );
    expect(screen.queryByText('头像卡片展示')).toBeNull();
  });

  it('should prefer tool-upage artifacts over duplicated data-upage-page artifacts', () => {
    const message: ChatUIMessage = {
      id: 'assistant-message-deduped-tool',
      role: 'assistant',
      parts: [
        {
          type: 'data-upage-page',
          data: {
            artifact: {
              id: 'legacy-contact-page',
              name: 'legacy-contact',
              title: '旧联系页',
            },
            actions: [],
          },
        },
        {
          type: 'tool-upage',
          toolCallId: 'tool-upage-deduped',
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
                actions: [],
              },
            ],
            emittedPages: ['contact'],
            pageCount: 1,
          },
        },
      ],
    };

    render(<AssistantMessage message={message} />);

    expect(screen.getAllByTestId('artifact-card')).toHaveLength(1);
    expect(screen.getByTestId('artifact-card').textContent).toBe('assistant-message-deduped-tool:contact-page:');
  });

  it('should render one artifact card per page fragment even when page names repeat', () => {
    const message: ChatUIMessage = {
      id: 'assistant-message-merged-tool-pages',
      role: 'assistant',
      parts: [
        {
          type: 'tool-upage',
          toolCallId: 'tool-upage-merged-1',
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
                actions: [],
              },
            ],
            emittedPages: ['index'],
            pageCount: 1,
          },
        },
        {
          type: 'tool-upage',
          toolCallId: 'tool-upage-merged-2',
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
                actions: [],
              },
            ],
            emittedPages: ['index'],
            pageCount: 1,
          },
        },
      ],
    };

    render(<AssistantMessage message={message} />);

    expect(screen.getAllByTestId('artifact-card')).toHaveLength(2);
    expect(screen.getByText('assistant-message-merged-tool-pages:index-page-a:')).toBeTruthy();
    expect(screen.getByText('assistant-message-merged-tool-pages:index-page-b:')).toBeTruthy();
  });

  it('should keep later step containers for repeated page fragments', () => {
    const message: ChatUIMessage = {
      id: 'assistant-message-merged-tool-steps',
      role: 'assistant',
      parts: [
        {
          type: 'step-start',
        },
        {
          type: 'tool-upage',
          toolCallId: 'tool-upage-step-1',
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
                actions: [],
              },
            ],
            emittedPages: ['index'],
            pageCount: 1,
          },
        },
        {
          type: 'step-start',
        },
        {
          type: 'tool-upage',
          toolCallId: 'tool-upage-step-2',
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
                actions: [],
              },
            ],
            emittedPages: ['index'],
            pageCount: 1,
          },
        },
      ],
    };

    render(<AssistantMessage message={message} />);

    expect(screen.getByTestId('step-container-1')).toBeTruthy();
    expect(screen.getByTestId('step-container-2')).toBeTruthy();
    expect(screen.getAllByTestId('artifact-card')).toHaveLength(2);
  });

  it('should hide the internal announce upage block tool card', () => {
    const message: ChatUIMessage = {
      id: 'assistant-message-hidden-tool',
      role: 'assistant',
      parts: [
        {
          type: 'step-start',
        },
        {
          type: 'tool-announceUpageBlock',
          toolCallId: 'tool-announce-upage-block-1',
          state: 'output-available',
          input: {
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
                domId: 'main',
                rootDomId: 'avatar-card-section',
              },
            ],
          },
          output: {
            pageName: 'index',
            actionCount: 1,
            announcedActions: ['avatar-card-section'],
          },
        },
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

    render(<AssistantMessage message={message} isStreaming />);

    expect(screen.queryByText('announceUpageBlock')).toBeNull();
    expect(screen.getByTestId('artifact-card').textContent).toBe(
      'assistant-message-hidden-tool:avatar-page:avatar-card-section',
    );
  });

  it('should render one progress item per block fragment', () => {
    const message: ChatUIMessage = {
      id: 'assistant-message-block-fragments',
      role: 'assistant',
      parts: [
        {
          type: 'data-upage-block-start',
          data: {
            artifact: {
              id: 'lumina-page',
              name: 'index',
              title: 'Lumina 企业官网',
            },
            action: {
              id: 'header-nav',
              action: 'add',
              pageName: 'index',
              content: '',
              domId: 'main',
              rootDomId: 'header-nav',
              validRootDomId: false,
            },
            sequence: 1,
          },
        },
        {
          type: 'data-upage-block-start',
          data: {
            artifact: {
              id: 'lumina-page',
              name: 'index',
              title: 'Lumina 企业官网',
            },
            action: {
              id: 'hero-section',
              action: 'add',
              pageName: 'index',
              content: '',
              domId: 'main',
              rootDomId: 'hero-section',
              validRootDomId: false,
            },
            sequence: 2,
          },
        },
      ],
    };

    render(<AssistantMessage message={message} isStreaming />);

    expect(screen.getAllByTestId('artifact-card')).toHaveLength(1);
    expect(screen.getByTestId('artifact-card').textContent).toBe(
      'assistant-message-block-fragments:lumina-page:header-nav,hero-section',
    );
  });

  it('should render page change status above block artifacts before tool-upage arrives', () => {
    const message: ChatUIMessage = {
      id: 'assistant-message-block-start-pending-status',
      role: 'assistant',
      parts: [
        {
          type: 'step-start',
        },
        {
          type: 'data-upage-block-start',
          data: {
            artifact: {
              id: 'landing-page',
              name: 'index',
              title: '首页',
            },
            action: {
              id: 'hero',
              action: 'add',
              pageName: 'index',
              content: '',
              domId: 'main',
              rootDomId: 'hero',
              validRootDomId: false,
            },
            sequence: 1,
          },
        },
      ],
    };

    render(<AssistantMessage message={message} isStreaming />);

    const stepContainer = screen.getByTestId('step-container-1');
    const statusTitle = within(stepContainer)
      .getAllByText('准备应用页面变更')
      .find((element) => element.tagName === 'SPAN');
    const statusCard = statusTitle?.closest('div[class*="rounded-md"]');
    const artifactCard = within(stepContainer).getByTestId('artifact-card');

    expect(within(stepContainer).getByText('已接收到页面区块，正在整理完整的页面变更指令。')).toBeTruthy();
    expect(statusCard).toBeTruthy();
    expect(artifactCard).toBeTruthy();
    expect(
      Boolean(
        statusCard &&
          artifactCard &&
          statusCard.compareDocumentPosition(artifactCard) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
  });

  it('should replace matching block progress with the final tool-upage artifact output', () => {
    const message: ChatUIMessage = {
      id: 'assistant-message-final-output-replaces-progress',
      role: 'assistant',
      parts: [
        {
          type: 'step-start',
        },
        {
          type: 'data-upage-block-start',
          data: {
            artifact: {
              id: 'lumina-page',
              name: 'index',
              title: 'Lumina 企业官网',
            },
            action: {
              id: 'header-nav',
              action: 'add',
              pageName: 'index',
              content: '',
              domId: 'main',
              rootDomId: 'header-nav',
              validRootDomId: false,
            },
            sequence: 1,
          },
        },
        {
          type: 'tool-upage',
          state: 'output-available',
          toolCallId: 'tool-upage-final',
          input: {
            pages: [],
          },
          output: {
            pages: [
              {
                artifact: {
                  id: 'lumina-page',
                  name: 'index',
                  title: 'Lumina 企业官网',
                },
                actions: [
                  {
                    id: 'header-nav',
                    action: 'add',
                    pageName: 'index',
                    content: '<header id="header-nav"></header>',
                    domId: 'main',
                    rootDomId: 'header-nav',
                    validRootDomId: true,
                  },
                  {
                    id: 'hero-section',
                    action: 'add',
                    pageName: 'index',
                    content: '<section id="hero-section"></section>',
                    domId: 'main',
                    rootDomId: 'hero-section',
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

    render(<AssistantMessage message={message} />);

    expect(screen.getAllByTestId('artifact-card')).toHaveLength(1);
    expect(
      screen.getByText('assistant-message-final-output-replaces-progress:lumina-page:header-nav,hero-section'),
    ).toBeTruthy();
    expect(screen.getByTestId('step-container-1')).toBeTruthy();
    expect(screen.queryByText('准备创建区块')).toBeNull();
  });

  it('should merge running upage tool status into the same step as block artifact cards', () => {
    const message: ChatUIMessage = {
      id: 'assistant-message-merged-running-page-change-step',
      role: 'assistant',
      parts: [
        {
          type: 'step-start',
        },
        {
          type: 'data-upage-block-start',
          data: {
            artifact: {
              id: 'profile-page',
              name: 'index',
              title: '个人主页',
            },
            action: {
              id: 'header',
              action: 'add',
              pageName: 'index',
              content: '',
              domId: 'main',
              rootDomId: 'header',
              validRootDomId: false,
            },
            sequence: 1,
          },
        },
        {
          type: 'step-start',
        },
        {
          type: 'tool-upage',
          toolCallId: 'tool-upage-running-merged',
          state: 'input-available',
          input: {
            pages: [
              {
                artifact: {
                  id: 'profile-page',
                  name: 'index',
                  title: '个人主页',
                },
                actions: [
                  {
                    id: 'about',
                    action: 'add',
                    pageName: 'index',
                    content: '<section id="about"></section>',
                    domId: 'main',
                    rootDomId: 'about',
                    validRootDomId: true,
                  },
                ],
              },
            ],
          },
        },
      ],
    };

    render(<AssistantMessage message={message} isStreaming />);

    const mergedStep = screen.getByTestId('step-container-1');
    expect(within(mergedStep).getByText('应用页面变更')).toBeTruthy();
    expect(within(mergedStep).getByTestId('artifact-card').textContent).toBe(
      'assistant-message-merged-running-page-change-step:profile-page:header',
    );
    expect(screen.queryByTestId('step-container-2')).toBeNull();
  });

  it('should keep page change status above artifact cards while streaming', () => {
    const message: ChatUIMessage = {
      id: 'assistant-message-page-change-order',
      role: 'assistant',
      parts: [
        {
          type: 'step-start',
        },
        {
          type: 'data-upage-block-start',
          data: {
            artifact: {
              id: 'portfolio-page',
              name: 'index',
              title: '个人主页',
            },
            action: {
              id: 'hero',
              action: 'add',
              pageName: 'index',
              content: '',
              domId: 'main',
              rootDomId: 'hero',
              validRootDomId: false,
            },
            sequence: 1,
          },
        },
        {
          type: 'step-start',
        },
        {
          type: 'tool-upage',
          toolCallId: 'tool-upage-order-check',
          state: 'input-available',
          input: {
            pages: [],
          },
        },
      ],
    };

    render(<AssistantMessage message={message} isStreaming />);

    const mergedStep = screen.getByTestId('step-container-1');
    const statusCard = within(mergedStep).getByText('应用页面变更').closest('div[class*="rounded-md"]');
    const artifactCard = within(mergedStep).getByTestId('artifact-card');

    expect(statusCard).toBeTruthy();
    expect(artifactCard).toBeTruthy();
    expect(
      Boolean(
        statusCard &&
          artifactCard &&
          statusCard.compareDocumentPosition(artifactCard) & Node.DOCUMENT_POSITION_FOLLOWING,
      ),
    ).toBe(true);
  });

  it('should keep step prose above the page change status card after merging page change steps', () => {
    const message: ChatUIMessage = {
      id: 'assistant-message-page-change-text-order',
      role: 'assistant',
      parts: [
        {
          type: 'step-start',
        },
        {
          type: 'text',
          text: '现在开始把首页改动应用到页面中。',
        },
        {
          type: 'data-upage-block-start',
          data: {
            artifact: {
              id: 'landing-page',
              name: 'index',
              title: '首页',
            },
            action: {
              id: 'hero',
              action: 'add',
              pageName: 'index',
              content: '',
              domId: 'main',
              rootDomId: 'hero',
              validRootDomId: false,
            },
            sequence: 1,
          },
        },
        {
          type: 'step-start',
        },
        {
          type: 'tool-upage',
          toolCallId: 'tool-upage-text-order-check',
          state: 'input-available',
          input: {
            pages: [],
          },
        },
      ],
    };

    render(<AssistantMessage message={message} isStreaming />);

    const mergedStep = screen.getByTestId('step-container-1');
    const prose = within(mergedStep).getByText('现在开始把首页改动应用到页面中。');
    const statusCard = within(mergedStep).getByText('应用页面变更').closest('div[class*="rounded-md"]');

    expect(statusCard).toBeTruthy();
    expect(Boolean(statusCard && prose.compareDocumentPosition(statusCard) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(
      true,
    );
  });

  it('should only keep the current reasoning card expanded while streaming', () => {
    const activeMessage: ChatUIMessage = {
      id: 'assistant-message-2-active',
      role: 'assistant',
      parts: [
        {
          type: 'reasoning',
          text: '先分析用户需求。',
        },
      ],
    };

    const completedReasoningMessage: ChatUIMessage = {
      id: 'assistant-message-2-completed',
      role: 'assistant',
      parts: [
        {
          type: 'reasoning',
          text: '先分析用户需求。',
        },
        {
          type: 'step-start',
        },
        {
          type: 'tool-historySummary',
          toolCallId: 'tool-history-summary-3',
          state: 'input-available',
          input: {},
        },
      ],
    };

    const { rerender } = render(<AssistantMessage message={activeMessage} isStreaming />);

    expect(screen.getByRole('button', { name: /思考过程/i }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.queryByText('执行中，实时更新')).toBeNull();

    rerender(<AssistantMessage message={completedReasoningMessage} isStreaming />);

    expect(screen.getByRole('button', { name: /思考过程/i }).getAttribute('aria-expanded')).toBe('false');
  });

  it('should render history summary tool output for users', () => {
    const message: ChatUIMessage = {
      id: 'assistant-message-3',
      role: 'assistant',
      parts: [
        {
          type: 'step-start',
        },
        {
          type: 'tool-historySummary',
          toolCallId: 'tool-history-summary-2',
          state: 'output-available',
          input: {},
          output: {
            hasHistory: true,
            summary: 'summary',
            reused: false,
          },
        },
      ],
    };

    render(<AssistantMessage message={message} />);

    expect(screen.getByText('生成历史摘要')).toBeTruthy();
    expect(screen.getByText('步骤 1')).toBeTruthy();
    expect(screen.getByText(/历史摘要已生成/)).toBeTruthy();
  });

  it('should dedupe repeated assistant prose across consecutive steps', () => {
    const repeatedSummary = '已完成修改：页面文案已更新，并新增了一个按钮。';
    const message: ChatUIMessage = {
      id: 'assistant-message-deduped-step-prose',
      role: 'assistant',
      parts: [
        {
          type: 'step-start',
        },
        {
          type: 'text',
          text: repeatedSummary,
        },
        {
          type: 'tool-finishRun',
          toolCallId: 'tool-finish-run-deduped',
          state: 'output-available',
          input: {
            requiresMutation: true,
          },
          output: {
            acknowledged: true,
            requiresMutation: true,
            effectiveMutationCount: 2,
            invalidStepCount: 0,
          },
        },
        {
          type: 'step-start',
        },
        {
          type: 'text',
          text: `  ${repeatedSummary}  `,
        },
      ],
    };

    render(<AssistantMessage message={message} />);

    expect(screen.getAllByText(repeatedSummary)).toHaveLength(1);
    expect(screen.getByTestId('step-container-1')).toBeTruthy();
    expect(screen.queryByTestId('step-container-2')).toBeNull();
  });

  it('should hide duplicate preparation step when preparation timeline is present', () => {
    const message: ChatUIMessage = {
      id: 'assistant-message-prepare-deduped',
      role: 'assistant',
      parts: [
        {
          type: 'data-preparation-stage',
          data: {
            stage: 'history-summary',
            status: 'complete',
            order: 0,
            label: '历史摘要',
            message: '历史对话摘要已生成。',
          },
        },
        {
          type: 'step-start',
        },
        {
          type: 'tool-historySummary',
          toolCallId: 'tool-history-summary-deduped',
          state: 'output-available',
          input: {},
          output: {
            hasHistory: true,
            summary: 'summary',
            reused: false,
          },
        },
      ],
    };

    render(<AssistantMessage message={message} />);

    expect(screen.getByText('上下文准备')).toBeTruthy();
    expect(screen.queryByText('生成历史摘要')).toBeNull();
    expect(screen.queryByText('步骤 1')).toBeNull();
  });

  it('should exclude design system from preparation timeline and keep the tool step visible', () => {
    const message: ChatUIMessage = {
      id: 'assistant-message-design-system-separated',
      role: 'assistant',
      parts: [
        {
          type: 'data-preparation-stage',
          data: {
            stage: 'history-summary',
            status: 'complete',
            order: 0,
            label: '历史摘要',
            message: '历史对话摘要已生成。',
          },
        },
        {
          type: 'step-start',
        },
        {
          type: 'tool-historySummary',
          toolCallId: 'tool-history-summary-design-separated',
          state: 'output-available',
          input: {},
          output: {
            hasHistory: true,
            summary: 'summary',
            reused: false,
          },
        },
        {
          type: 'data-preparation-stage',
          data: {
            stage: 'design-system',
            status: 'in-progress',
            order: 1,
            label: '设计系统',
            message: '正在准备设计系统规范。',
          },
        },
        {
          type: 'step-start',
        },
        {
          type: 'tool-ensureDesignSystem',
          toolCallId: 'tool-ensure-design-system-separated',
          state: 'input-available',
          input: {},
        },
      ],
    };

    render(<AssistantMessage message={message} isStreaming />);

    expect(screen.getByText('上下文准备')).toBeTruthy();
    expect(screen.queryByText('正在准备设计系统规范。')).toBeNull();
    expect(screen.getByText('步骤 1')).toBeTruthy();
    expect(screen.getByText('准备设计系统')).toBeTruthy();
    expect(screen.getByText('正在准备设计系统规范...')).toBeTruthy();
  });

  it('should render ensure design system tool while it is running', () => {
    const message: ChatUIMessage = {
      id: 'assistant-message-running-design-md',
      role: 'assistant',
      parts: [
        {
          type: 'step-start',
        },
        {
          type: 'tool-ensureDesignSystem',
          toolCallId: 'tool-ensure-design-system-running',
          state: 'input-available',
          input: {},
        },
      ],
    };

    render(<AssistantMessage message={message} isStreaming />);

    expect(screen.getByText('步骤 1')).toBeTruthy();
    expect(screen.getByText('执行中')).toBeTruthy();
    expect(screen.getByText('准备设计系统')).toBeTruthy();
    expect(screen.getByText('正在准备设计系统规范...')).toBeTruthy();
  });

  it('should render running tools as aborted when the message is interrupted', () => {
    const message: ChatUIMessage = {
      id: 'assistant-message-aborted-design-md',
      role: 'assistant',
      parts: [
        {
          type: 'step-start',
        },
        {
          type: 'tool-ensureDesignSystem',
          toolCallId: 'tool-ensure-design-system-aborted',
          state: 'input-available',
          input: {},
        },
      ],
    };

    render(<AssistantMessage message={message} isAborted />);

    expect(screen.getByText('准备设计系统')).toBeTruthy();
    expect(screen.getByText('已中断')).toBeTruthy();
    expect(screen.getByText('设计系统规范生成已中断')).toBeTruthy();
  });

  it('should render streamed design system preview even before tool output is available', () => {
    const message: ChatUIMessage = {
      id: 'assistant-message-streaming-design-only',
      role: 'assistant',
      parts: [
        {
          type: 'data-design-md',
          data: {
            content: `---
name: Aurora
colors:
  primary: "#111827"
typography:
  body:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
---

## Overview

冷静、克制、现代。`,
          },
        },
      ],
    };

    render(<AssistantMessage message={message} isStreaming />);

    expect(screen.getByText('设计系统')).toBeTruthy();
    expect(screen.getByText('Aurora')).toBeTruthy();
    expect(screen.getAllByText('设计系统生成中').length).toBeGreaterThan(0);
    expect(screen.getByText('预览已可用，当前已识别 1 个颜色、1 个字体层级')).toBeTruthy();
  });

  it('should render design body fallback when markdown prose arrives before token parsing succeeds', () => {
    const message: ChatUIMessage = {
      id: 'assistant-message-streaming-design-body-fallback',
      role: 'assistant',
      parts: [
        {
          type: 'data-design-md',
          data: {
            content: `---
name: Aurora
---

## Notes

优先使用克制的冷色背景，并让主要 CTA 保持高对比。`,
          },
        },
      ],
    };

    render(<AssistantMessage message={message} isStreaming />);

    expect(screen.getByText('设计说明')).toBeTruthy();
    expect(screen.getByText(/优先使用克制的冷色背景，并让主要 CTA 保持高对比。/)).toBeTruthy();
    expect(screen.queryByText('正在补充设计系统说明...')).toBeNull();
  });

  it('should collapse the design system preview after streaming completes and allow manual expand', () => {
    const message: ChatUIMessage = {
      id: 'assistant-message-streaming-design-collapse',
      role: 'assistant',
      parts: [
        {
          type: 'data-design-md',
          data: {
            content: `---
name: Aurora
colors:
  primary: "#111827"
typography:
  body:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
---

## Overview

冷静、克制、现代。`,
          },
        },
      ],
    };

    const { rerender } = render(<AssistantMessage message={message} isStreaming />);

    const toggle = screen.getByRole('button', { name: /设计系统/i });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('primary')).toBeTruthy();

    rerender(<AssistantMessage message={message} />);

    const collapsedToggle = screen.getByRole('button', { name: /设计系统/i });
    expect(collapsedToggle.getAttribute('aria-expanded')).toBe('false');
    expect(collapsedToggle.nextElementSibling?.className).toContain('hidden');
    expect(screen.getByText('已解析 1 个颜色、1 个字体层级')).toBeTruthy();

    fireEvent.click(collapsedToggle);

    expect(screen.getByRole('button', { name: /设计系统/i }).getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: /设计系统/i }).nextElementSibling?.className).not.toContain('hidden');
    expect(screen.getByText('primary')).toBeTruthy();
  });

  it('should parse and render streaming design tokens before frontmatter closes', () => {
    const message: ChatUIMessage = {
      id: 'assistant-message-streaming-design-frontmatter',
      role: 'assistant',
      parts: [
        {
          type: 'data-design-md',
          data: {
            content: `---
name: Aurora
colors:
  primary: "#111827"
  accent: "#7c3aed"
typography:
  body:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6`,
          },
        },
      ],
    };

    render(<AssistantMessage message={message} isStreaming />);

    expect(screen.getByText('Aurora')).toBeTruthy();
    expect(screen.getByText('primary')).toBeTruthy();
    expect(screen.getByText('#111827')).toBeTruthy();
    expect(screen.getByText('正在继续解析设计 token，当前已识别 2 个颜色、1 个字体层级')).toBeTruthy();
  });

  it('should render design system preview once when both tool output and streamed content exist', () => {
    const message: ChatUIMessage = {
      id: 'assistant-message-4',
      role: 'assistant',
      parts: [
        {
          type: 'step-start',
        },
        {
          type: 'tool-ensureDesignSystem',
          toolCallId: 'tool-ensure-design-system-1',
          state: 'output-available',
          input: {},
          output: {
            reused: false,
            content: `---
name: Aurora
colors:
  primary: "#111827"
typography:
  body:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
---

## Overview

冷静、克制、现代。`,
          },
        },
        {
          type: 'data-design-md',
          data: {
            content: `---
name: Aurora
colors:
  primary: "#111827"
typography:
  body:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
---

## Overview

冷静、克制、现代。`,
          },
        },
      ],
    };

    render(<AssistantMessage message={message} />);

    expect(screen.getAllByText('Aurora')).toHaveLength(1);
    expect(screen.getByText('准备设计系统')).toBeTruthy();
    expect(screen.getByText('步骤 1')).toBeTruthy();
  });
});
