import { describe, expect, it } from 'vitest';
import { resolveExecutionModeProviderOptions } from './language-model-execution';

describe('resolveExecutionModeProviderOptions', () => {
  it('should return undefined for default execution mode', () => {
    expect(resolveExecutionModeProviderOptions('Anthropic', 'default')).toBeUndefined();
  });

  it('should resolve anthropic no-thinking options', () => {
    expect(resolveExecutionModeProviderOptions('Anthropic', 'no-thinking')).toEqual({
      anthropic: {
        thinking: { type: 'disabled' },
      },
    });
  });

  it('should resolve google no-thinking options', () => {
    expect(resolveExecutionModeProviderOptions('Google', 'no-thinking')).toEqual({
      google: {
        thinkingConfig: {
          thinkingBudget: 0,
          includeThoughts: false,
        },
      },
    });
  });

  it('should resolve openrouter no-thinking options', () => {
    expect(resolveExecutionModeProviderOptions('OpenRouter', 'no-thinking')).toEqual({
      openrouter: {
        reasoning: {
          effort: 'none',
          exclude: true,
        },
      },
    });
  });
});
