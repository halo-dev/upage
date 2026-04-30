import { describe, expect, it, vi } from 'vitest';

vi.mock('~/.server/service/prisma', () => ({
  prisma: {},
}));

import { resolveGuardrailStopReason, sanitizeMessagesForAgent } from './runtime';

describe('resolveGuardrailStopReason', () => {
  it('should keep explicit guardrail stop reasons', () => {
    expect(
      resolveGuardrailStopReason({
        guardrailStopReason: 'duplicate_action',
        streamFailed: false,
        finalStepCount: 24,
        pageGenerationStepLimit: 24,
        finishReason: 'tool-calls',
      }),
    ).toBe('duplicate_action');
  });

  it('should mark step budget exceeded when the agent stops at the limit with pending tool calls', () => {
    expect(
      resolveGuardrailStopReason({
        streamFailed: false,
        finalStepCount: 24,
        pageGenerationStepLimit: 24,
        finishReason: 'tool-calls',
      }),
    ).toBe('step_budget_exceeded');
  });

  it('should not mark natural completion at the step limit as step budget exceeded', () => {
    expect(
      resolveGuardrailStopReason({
        streamFailed: false,
        finalStepCount: 24,
        pageGenerationStepLimit: 24,
        finishReason: 'stop',
      }),
    ).toBeUndefined();
  });
});

describe('sanitizeMessagesForAgent', () => {
  it('should inject a visual hint when file parts are not allowed', () => {
    const [message] = sanitizeMessagesForAgent(
      [
        {
          id: 'user-1',
          role: 'user',
          metadata: {},
          parts: [
            { type: 'text', text: '参考这张图做页面' },
            {
              type: 'file',
              url: '/uploads/chat-references/user-1/msg/image.png',
              mediaType: 'image/png',
              filename: 'image.png',
            },
          ],
        },
      ],
      { allowFileParts: false },
    );

    expect(message.parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'text', text: '参考这张图做页面' }),
        expect.objectContaining({
          type: 'text',
          text: expect.stringContaining('用户提供了 1 张图片视觉参考'),
        }),
      ]),
    );
    expect(message.parts.some((part) => part.type === 'file')).toBe(false);
  });

  it('should preserve structured page semantics as plain text summaries', () => {
    const [message] = sanitizeMessagesForAgent([
      {
        id: 'assistant-1',
        role: 'assistant',
        metadata: {},
        parts: [
          {
            type: 'data-upage-page',
            data: {
              artifact: {
                id: 'artifact-1',
                name: 'index',
                title: '首页',
              },
              actions: [
                {
                  id: 'hero-update',
                  action: 'update',
                  pageName: 'index',
                  validRootDomId: true,
                  sort: 0,
                  content: '<section>hero</section>',
                  rootDomId: 'hero-root',
                  domId: 'hero-root',
                },
              ],
              summary: '首页 hero 区块更新',
            },
          },
        ],
      },
    ]);

    expect(message.parts).toEqual([
      expect.objectContaining({
        type: 'text',
        text: '页面 index（首页）：update:hero-update',
      }),
    ]);
  });
});
