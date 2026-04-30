import { beforeEach, describe, expect, it, vi } from 'vitest';

const { streamTextMock } = vi.hoisted(() => {
  return {
    streamTextMock: vi.fn(),
  };
});

vi.mock('ai', () => {
  return {
    streamText: streamTextMock,
  };
});

import { generateDesignMd } from './generate-design-md';

describe('generateDesignMd', () => {
  beforeEach(() => {
    streamTextMock.mockReset();
  });

  it('should stream and accumulate design markdown content', async () => {
    streamTextMock.mockReturnValue({
      fullStream: createFullStream([
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', text: '---\n' },
        { type: 'text-delta', id: 'text-1', text: 'name: Aurora\n' },
        { type: 'text-delta', id: 'text-1', text: '---\n' },
        { type: 'text-end', id: 'text-1' },
      ]),
      totalUsage: Promise.resolve({
        inputTokens: 12,
        outputTokens: 34,
        totalTokens: 46,
      }),
    });

    const chunks: string[] = [];
    const result = await generateDesignMd({
      userMessage: createUserMessage('做一个科技风官网'),
      modelCapabilities: {
        supportsVisionInput: false,
        supportsFileReference: false,
        supportsImageUrl: false,
        supportsBase64Image: false,
        capabilityConfidence: 'unknown',
      },
      model: {} as never,
      onStreamEvent: (event) => {
        if (event.chunk.type === 'text-delta') {
          chunks.push(event.text);
        }
      },
    });

    expect(result).toEqual({
      content: '---\nname: Aurora\n---\n',
      totalUsage: {
        inputTokens: 12,
        outputTokens: 34,
        totalTokens: 46,
      },
    });
    expect(chunks).toEqual(['---\n', '---\nname: Aurora\n', '---\nname: Aurora\n---\n']);
  });

  it('should forward reasoning chunks while streaming design markdown', async () => {
    streamTextMock.mockReturnValue({
      fullStream: createFullStream([
        { type: 'reasoning-start', id: 'reasoning-1' },
        { type: 'reasoning-delta', id: 'reasoning-1', text: '先整理品牌语义。' },
        { type: 'reasoning-end', id: 'reasoning-1' },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', text: '---\n' },
        { type: 'text-end', id: 'text-1' },
      ]),
      totalUsage: Promise.resolve({
        inputTokens: 8,
        outputTokens: 10,
        totalTokens: 18,
      }),
    });

    const streamEvents: unknown[] = [];
    await generateDesignMd({
      userMessage: createUserMessage('做一个科技风官网'),
      modelCapabilities: {
        supportsVisionInput: false,
        supportsFileReference: false,
        supportsImageUrl: false,
        supportsBase64Image: false,
        capabilityConfidence: 'unknown',
      },
      model: {} as never,
      onStreamEvent: (event) => {
        if (event.chunk.type.startsWith('reasoning')) {
          streamEvents.push(event.chunk);
        }
      },
    });

    expect(streamEvents).toEqual([
      { type: 'reasoning-start', id: 'reasoning-1' },
      { type: 'reasoning-delta', id: 'reasoning-1', delta: '先整理品牌语义。' },
      { type: 'reasoning-end', id: 'reasoning-1' },
    ]);
  });

  it('should throw abort error when the signal aborts during streaming', async () => {
    const controller = new AbortController();

    streamTextMock.mockReturnValue({
      fullStream: createAbortableFullStream(controller),
      totalUsage: Promise.resolve({
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
      }),
    });

    await expect(
      generateDesignMd({
        userMessage: createUserMessage('做一个科技风官网'),
        modelCapabilities: {
          supportsVisionInput: false,
          supportsFileReference: false,
          supportsImageUrl: false,
          supportsBase64Image: false,
          capabilityConfidence: 'unknown',
        },
        model: {} as never,
        abortSignal: controller.signal,
      }),
    ).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('should fall back to text-only prompting when the model supports vision but the user message has no image', async () => {
    streamTextMock.mockReturnValue({
      fullStream: createFullStream([
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', text: '---\n' },
        { type: 'text-end', id: 'text-1' },
      ]),
      totalUsage: Promise.resolve({
        inputTokens: 6,
        outputTokens: 2,
        totalTokens: 8,
      }),
    });

    await generateDesignMd({
      userMessage: createUserMessage('请参考上面的图片做一个公司官网'),
      modelCapabilities: {
        supportsVisionInput: true,
        supportsFileReference: false,
        supportsImageUrl: false,
        supportsBase64Image: false,
        capabilityConfidence: 'unknown',
      },
      model: {} as never,
    });

    expect(streamTextMock).toHaveBeenCalledTimes(1);
    expect(streamTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('请参考上面的图片做一个公司官网'),
        system: expect.stringContaining(
          '若用户文字中提到“上面的图片/参考图”等，但当前输入并无图片也无视觉摘要，不要臆测任何图片内容',
        ),
      }),
    );
  });

  it('should report estimated usage when abort happens before the step finishes', async () => {
    const controller = new AbortController();
    const onAbortUsage = vi.fn();

    streamTextMock.mockReturnValue({
      fullStream: createAbortableFullStream(controller),
      totalUsage: Promise.resolve({
        inputTokens: 1,
        outputTokens: 1,
        totalTokens: 2,
      }),
    });

    await expect(
      generateDesignMd({
        userMessage: createUserMessage('做一个科技风官网'),
        modelCapabilities: {
          supportsVisionInput: false,
          supportsFileReference: false,
          supportsImageUrl: false,
          supportsBase64Image: false,
          capabilityConfidence: 'unknown',
        },
        model: {} as never,
        abortSignal: controller.signal,
        onAbortUsage,
      }),
    ).rejects.toMatchObject({
      name: 'AbortError',
    });

    expect(onAbortUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        inputTokens: expect.any(Number),
        outputTokens: expect.any(Number),
        totalTokens: expect.any(Number),
      }),
    );
  });
});

async function* createFullStream(chunks: unknown[]) {
  for (const chunk of chunks) {
    yield chunk;
  }
}

async function* createAbortableFullStream(controller: AbortController) {
  yield { type: 'text-start', id: 'text-1' };
  yield { type: 'text-delta', id: 'text-1', text: '---\n' };
  controller.abort();
  yield { type: 'text-delta', id: 'text-1', text: 'name: Aurora\n' };
}

function createUserMessage(text: string) {
  return {
    role: 'user' as const,
    metadata: {},
    parts: [{ type: 'text' as const, text }],
  };
}
