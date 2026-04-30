import { describe, expect, it } from 'vitest';
import { shouldBlockPrematureFinishRun } from './page-builder-guard';

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
