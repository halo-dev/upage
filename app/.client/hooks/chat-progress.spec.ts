import { describe, expect, it } from 'vitest';
import type { ChatUIMessage, ProgressAnnotation } from '~/types/message';
import { getToolProgressAnnotations, mergeStreamingProgressAnnotations } from './chat-progress';

describe('chat-progress', () => {
  it('should keep preparation progress and append running page generation progress', () => {
    const baseProgress: ProgressAnnotation[] = [
      {
        label: '设计系统',
        status: 'complete',
        order: 4,
        message: '设计系统规范已生成。',
      },
    ];
    const messages: ChatUIMessage[] = [
      {
        id: 'assistant-message-1',
        role: 'assistant',
        parts: [
          {
            type: 'step-start',
          },
          {
            type: 'tool-upage',
            toolCallId: 'tool-upage-1',
            state: 'input-available',
            input: {
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
            },
          },
        ],
      },
    ];

    const progress = mergeStreamingProgressAnnotations(baseProgress, messages);

    expect(progress).toHaveLength(2);
    expect(progress[0]).toEqual(baseProgress[0]);
    expect(progress[1]).toMatchObject({
      status: 'in-progress',
      message: '正在生成页面内容。',
    });
  });

  it('should expose completed page generation progress from tool output', () => {
    const messages: ChatUIMessage[] = [
      {
        id: 'assistant-message-2',
        role: 'assistant',
        parts: [
          {
            type: 'tool-upage',
            toolCallId: 'tool-upage-2',
            state: 'output-available',
            input: {
              pages: [],
            },
            output: {
              pages: [],
              emittedPages: ['index', 'pricing'],
              pageCount: 2,
            },
          },
        ],
      },
    ];

    const progress = getToolProgressAnnotations(messages);

    expect(progress).toHaveLength(1);
    expect(progress[0]).toMatchObject({
      status: 'complete',
      message: '页面变更已提交。',
    });
  });

  it('should expose announced block preparation before upage output arrives', () => {
    const messages: ChatUIMessage[] = [
      {
        id: 'assistant-message-3',
        role: 'assistant',
        parts: [
          {
            type: 'data-upage-block-start',
            data: {
              artifact: {
                id: 'home-page',
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
      },
    ];

    const progress = getToolProgressAnnotations(messages);

    expect(progress).toHaveLength(1);
    expect(progress[0]).toMatchObject({
      status: 'in-progress',
      message: '正在准备页面内容。',
    });
  });

  it('should collapse verbose upage validation errors in progress', () => {
    const messages: ChatUIMessage[] = [
      {
        id: 'assistant-message-4',
        role: 'assistant',
        parts: [
          {
            type: 'tool-upage',
            toolCallId: 'tool-upage-error-1',
            state: 'output-error',
            input: {
              pages: [],
            },
            errorText:
              'Invalid input for tool upage: Type validation failed: Value: {"pages":[{"artifact":{"id":"index","name":"index","title":"首页"},"actions":[{"patches":[{"type":"replace-node"}]}]}]}. Error message: [{"path":["actions",0,"patches",0,"html"]}]',
          },
        ],
      },
    ];

    const progress = getToolProgressAnnotations(messages);

    expect(progress).toHaveLength(1);
    expect(progress[0]).toMatchObject({
      status: 'stopped',
      message: '页面变更校验失败：删除节点时请使用 remove-node，不要用 replace-node。',
    });
  });
});
