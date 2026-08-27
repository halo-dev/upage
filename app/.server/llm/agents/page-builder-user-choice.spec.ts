import { describe, expect, it, vi } from 'vitest';
import { createRequestUserChoiceTool } from './page-builder-user-choice';

describe('createRequestUserChoiceTool', () => {
  it('returns a stable pending response keyed by the tool call', async () => {
    const markEffectiveTool = vi.fn();
    const choiceTool = createRequestUserChoiceTool(markEffectiveTool);

    const result = await choiceTool.execute?.(
      {
        question: '你更喜欢哪种视觉方向？',
        options: [
          { id: 'editorial', label: '编辑感' },
          { id: 'playful', label: '活泼感' },
        ],
        mode: 'single',
        allowCustomInput: true,
      },
      {
        toolCallId: 'choice-style-1',
        messages: [],
        abortSignal: new AbortController().signal,
      },
    );

    expect(markEffectiveTool).toHaveBeenCalledWith('requestUserChoice');
    expect(result).toEqual({
      acknowledged: true,
      awaitingUserResponse: true,
      choiceId: 'choice-style-1',
    });
  });
});
