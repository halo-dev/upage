import { describe, expect, it, vi } from 'vitest';
import { ChatStore } from './chat';

describe('ChatStore.waitForAllActionsSettled', () => {
  it('should wait for every artifact runner to become idle', async () => {
    const firstWait = vi.fn().mockResolvedValue(undefined);
    const secondWait = vi.fn().mockResolvedValue(undefined);

    await ChatStore.prototype.waitForAllActionsSettled.call({
      artifacts: {
        get: () =>
          new Map([
            [
              'message-1',
              new Map([
                ['artifact-1', { runner: { waitForIdle: firstWait } }],
                ['artifact-2', { runner: { waitForIdle: secondWait } }],
              ]),
            ],
          ]),
      },
    });

    expect(firstWait).toHaveBeenCalledTimes(1);
    expect(secondWait).toHaveBeenCalledTimes(1);
  });
});
