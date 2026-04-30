import { describe, expect, it } from 'vitest';
import { getActiveRewindTo } from './useChatMessage';

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
