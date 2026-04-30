import { defaultSettingsMiddleware, type LanguageModel, wrapLanguageModel } from 'ai';

export type LanguageModelExecutionMode = 'default' | 'no-thinking';

export function resolveExecutionModeProviderOptions(providerName: string, executionMode: LanguageModelExecutionMode) {
  if (executionMode !== 'no-thinking') {
    return undefined;
  }

  switch (providerName) {
    case 'Anthropic':
      return {
        anthropic: {
          thinking: { type: 'disabled' as const },
        },
      };
    case 'Google':
      return {
        google: {
          thinkingConfig: {
            thinkingBudget: 0,
            includeThoughts: false,
          },
        },
      };
    case 'OpenRouter':
      return {
        openrouter: {
          reasoning: {
            effort: 'none' as const,
            exclude: true,
          },
        },
      };
    default:
      return undefined;
  }
}

export function applyLanguageModelExecutionMode({
  model,
  providerName,
  executionMode,
}: {
  model: LanguageModel;
  providerName: string;
  executionMode: LanguageModelExecutionMode;
}) {
  const providerOptions = resolveExecutionModeProviderOptions(providerName, executionMode) as
    | Record<string, unknown>
    | undefined;

  if (!providerOptions) {
    return model;
  }

  return wrapLanguageModel({
    model: model as Parameters<typeof wrapLanguageModel>[0]['model'],
    middleware: defaultSettingsMiddleware({
      settings: {
        providerOptions: providerOptions as never,
      },
    }),
  });
}
