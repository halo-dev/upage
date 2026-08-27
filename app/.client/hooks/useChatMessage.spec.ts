import { describe, expect, it } from 'vitest';
import { getActiveRewindTo, hasCompletedUserChoiceRequest } from './useChatMessage';

describe('getActiveRewindTo', () => {
  it('should keep using the latest stable message while rewinding', () => {
    expect(
      getActiveRewindTo({
        rewindTo: 'assistant-rewind-base',
        lastStableMessageId: 'assistant-branch-latest',
      }),
    ).toBe('assistant-branch-latest');
  });

  it('should fall back to the original rewind target before the first new turn finishes', () => {
    expect(
      getActiveRewindTo({
        rewindTo: 'assistant-rewind-base',
        lastStableMessageId: undefined,
      }),
    ).toBe('assistant-rewind-base');
  });

  it('should return null when the chat is not rewinding', () => {
    expect(
      getActiveRewindTo({
        rewindTo: null,
        lastStableMessageId: 'assistant-latest',
      }),
    ).toBeNull();
  });
});

describe('hasCompletedUserChoiceRequest', () => {
  it('should recognize a completed user-choice tool request', () => {
    expect(
      hasCompletedUserChoiceRequest({
        parts: [
          {
            type: 'tool-requestUserChoice',
            toolCallId: 'choice-1',
            state: 'output-available',
            input: {
              question: '选择风格',
              options: [
                { id: 'tech', label: '科技风' },
                { id: 'warm', label: '自然风' },
              ],
              mode: 'single',
              allowCustomInput: true,
            },
            output: { acknowledged: true, awaitingUserResponse: true, choiceId: 'choice-1' },
          },
        ],
      }),
    ).toBe(true);
  });
});
