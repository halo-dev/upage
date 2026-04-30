import { beforeEach, describe, expect, it, vi } from 'vitest';

const { streamTextMock, consumeStreamTextFullStreamMock } = vi.hoisted(() => ({
  streamTextMock: vi.fn(),
  consumeStreamTextFullStreamMock: vi.fn(),
}));

vi.mock('ai', () => ({
  streamText: streamTextMock,
}));

vi.mock('./ui-message-stream', () => ({
  consumeStreamTextFullStream: consumeStreamTextFullStreamMock,
}));

import { structuredPageSnapshot } from './structured-page-snapshot';

describe('structuredPageSnapshot', () => {
  beforeEach(() => {
    streamTextMock.mockReset();
    consumeStreamTextFullStreamMock.mockReset();

    streamTextMock.mockReturnValue({
      fullStream: {},
      totalUsage: Promise.resolve({ totalTokens: 12 }),
      content: Promise.resolve([{ type: 'text', text: '<xml />' }]),
    });
    consumeStreamTextFullStreamMock.mockResolvedValue('<xml />');
  });

  it('builds a lightweight outline snapshot prompt', async () => {
    await structuredPageSnapshot({
      pages: [
        {
          id: 'page-1',
          messageId: 'message-1',
          name: 'index',
          title: '首页',
          content: '<main><section id="hero"><h1>首页</h1></section><script>console.log(1)</script></main>',
          actionIds: [],
        } as any,
      ],
      mode: 'outline',
      model: {} as any,
      abortSignal: new AbortController().signal,
    });

    expect(streamTextMock).toHaveBeenCalledTimes(1);
    const args = streamTextMock.mock.calls[0][0];
    expect(args.system).toContain('<snapshot_outline>');
    expect(args.prompt).toContain('页面概览：');
    expect(args.prompt).not.toContain('console.log(1)');
  });

  it('builds a detailed snapshot prompt with the current task', async () => {
    await structuredPageSnapshot({
      pages: [
        {
          id: 'page-2',
          messageId: 'message-1',
          name: 'pricing',
          title: '定价页',
          content: '<main><section id="plans"><h2>套餐</h2></section></main>',
          actionIds: [],
        } as any,
      ],
      mode: 'detailed',
      userTask: '把套餐按钮改成更醒目的样式',
      model: {} as any,
      abortSignal: new AbortController().signal,
    });

    const args = streamTextMock.mock.calls[0][0];
    expect(args.system).toContain('<snapshot_detailed>');
    expect(args.prompt).toContain('把套餐按钮改成更醒目的样式');
    expect(args.prompt).toContain('页面内容片段：');
  });
});
