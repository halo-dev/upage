import { describe, expect, it, vi } from 'vitest';
import { generateChatDescription } from './chat-description';

const { streamTextMock } = vi.hoisted(() => ({
  streamTextMock: vi.fn(),
}));

vi.mock('ai', () => ({
  streamText: streamTextMock,
}));

describe('generateChatDescription', () => {
  it('should trim the model output into a single-line title', async () => {
    streamTextMock.mockReturnValue({
      text: Promise.resolve('“AI 产品官网”\n补充说明'),
      totalUsage: Promise.resolve({
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
      }),
    });

    const result = await generateChatDescription({
      message: {
        role: 'user',
        metadata: {},
        parts: [{ type: 'text', text: '帮我生成一个 AI 产品官网首页。' }],
      },
      model: {} as never,
    });

    expect(result.description).toBe('AI 产品官网');
    expect(streamTextMock).toHaveBeenCalledTimes(1);
  });

  it('should cap overly long titles', async () => {
    streamTextMock.mockReturnValue({
      text: Promise.resolve('这是一个非常非常非常非常非常非常非常长的标题输出用于测试截断能力'),
      totalUsage: Promise.resolve({
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
      }),
    });

    const result = await generateChatDescription({
      message: {
        role: 'user',
        metadata: {},
        parts: [{ type: 'text', text: '请帮我设计一个很复杂的网站。' }],
      },
      model: {} as never,
    });

    expect(Array.from(result.description)).toHaveLength(30);
  });
});
