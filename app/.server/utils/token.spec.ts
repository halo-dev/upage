import { describe, expect, it } from 'vitest';
import { approximateUsageFromContent, estimateAgentStepAbortUsage, estimateTextStreamAbortUsage } from './token';

describe('token utils', () => {
  it('should count tool-upage input pages toward approximate token usage', () => {
    const usage = approximateUsageFromContent([
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
      } as any,
    ]);

    expect(usage).toBeGreaterThan(0);
  });

  it('should estimate unfinished text stream usage with prompt input', () => {
    const usage = estimateTextStreamAbortUsage({
      system: 'system prompt',
      prompt: 'user prompt',
      streamedText: 'partial output',
    });

    expect(usage.inputTokens).toBeGreaterThan(0);
    expect(usage.outputTokens).toBeGreaterThan(0);
    expect(usage.totalTokens).toBe(usage.inputTokens + usage.outputTokens);
  });

  it('should estimate unfinished agent step usage from prepared step and partial response', () => {
    const usage = estimateAgentStepAbortUsage({
      system: 'agent system',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
      responseParts: [
        { type: 'text', text: 'partial answer' },
        { type: 'reasoning', text: 'thinking' },
      ] as any,
    });

    expect(usage.inputTokens).toBeGreaterThan(0);
    expect(usage.outputTokens).toBeGreaterThan(0);
    expect(usage.reasoningTokens).toBeGreaterThan(0);
    expect(usage.totalTokens).toBe(usage.inputTokens + usage.outputTokens);
  });
});
