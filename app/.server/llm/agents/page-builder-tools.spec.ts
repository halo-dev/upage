import { describe, expect, it, vi } from 'vitest';
import { shouldBlockPrematureFinishRun } from './page-builder-guard';
import { createPageBuilderMutationTools } from './page-builder-mutation-tools';

describe('shouldBlockPrematureFinishRun', () => {
  it('blocks finishRun when the current request requires an actual page mutation', () => {
    expect(
      shouldBlockPrematureFinishRun(
        {
          effectiveMutationCount: 0,
          hasRejectedPageMutation: false,
        },
        true,
      ),
    ).toBe(true);
  });

  it('blocks finishRun after a rejected page mutation with no effective changes', () => {
    expect(
      shouldBlockPrematureFinishRun(
        {
          effectiveMutationCount: 0,
          hasRejectedPageMutation: true,
        },
        false,
      ),
    ).toBe(true);
  });

  it('allows finishRun after effective page changes were submitted', () => {
    expect(
      shouldBlockPrematureFinishRun(
        {
          effectiveMutationCount: 1,
          hasRejectedPageMutation: true,
        },
        true,
      ),
    ).toBe(false);
  });

  it('does not block finishRun when no mutation attempt was rejected', () => {
    expect(
      shouldBlockPrematureFinishRun(
        {
          effectiveMutationCount: 0,
          hasRejectedPageMutation: false,
        },
        false,
      ),
    ).toBe(false);
  });
});

describe('createPageBuilderMutationTools.finishRun', () => {
  it('falls back to state when the model omits requiresMutation', async () => {
    const tools = createPageBuilderMutationTools({
      state: {
        emittedPages: [],
        effectiveMutationCount: 0,
        finishRequested: false,
        guardrailStopReason: undefined,
        hasRejectedPageMutation: false,
        invalidStepCount: 0,
        lastEffectiveTool: undefined,
      } as never,
      markEffectiveTool: vi.fn(),
      markInvalidToolCall: vi.fn(),
      announcedBlockKeys: new Set(),
      submittedActionKeys: new Set(),
    });

    const result = await tools.finishRunTool.execute?.(
      {
        reason: '信息不足，无法判断目标网站应当参考什么样式。',
      },
      {
        toolCallId: 'finish-run-defaults',
        messages: [],
        abortSignal: new AbortController().signal,
      },
    );

    expect(result).toMatchObject({
      acknowledged: true,
      requiresMutation: false,
    });
  });

  it('treats omitted requiresMutation as true after a rejected page mutation', async () => {
    const tools = createPageBuilderMutationTools({
      state: {
        emittedPages: [],
        effectiveMutationCount: 0,
        finishRequested: false,
        guardrailStopReason: undefined,
        hasRejectedPageMutation: true,
        invalidStepCount: 0,
        lastEffectiveTool: undefined,
      } as never,
      markEffectiveTool: vi.fn(),
      markInvalidToolCall: vi.fn(),
      announcedBlockKeys: new Set(),
      submittedActionKeys: new Set(),
    });

    const result = await tools.finishRunTool.execute?.(
      {
        reason: '这次提交没有生效。',
      },
      {
        toolCallId: 'finish-run-blocked',
        messages: [],
        abortSignal: new AbortController().signal,
      },
    );

    expect(result).toMatchObject({
      acknowledged: false,
      requiresMutation: true,
    });
  });

});
