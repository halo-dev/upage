import {
  applyLanguageModelExecutionMode,
  type LanguageModelExecutionMode,
} from '~/.server/llm/language-model-execution';
import { LLMManager } from '~/.server/modules/llm/manager.server';

const llmManager = LLMManager.getInstance();

export const DEFAULT_MODEL = llmManager.getDefaultModel();
export const MINOR_MODEL = llmManager.getMinorModel();
export const DEFAULT_PROVIDER = llmManager.getDefaultProvider();
export const VISION_PROVIDER_NAME = llmManager.getVisionProviderName();
export const VISION_MODEL = llmManager.getVisionModel();

export const DEFAULT_MODEL_DETAILS = DEFAULT_PROVIDER.staticModels.find((m) => m.name === DEFAULT_MODEL);
export const MINOR_MODEL_DETAILS = DEFAULT_PROVIDER.staticModels.find((m) => m.name === MINOR_MODEL);

export const getModel = (model: string, options?: { executionMode?: LanguageModelExecutionMode }) => {
  const languageModel = DEFAULT_PROVIDER.getModelInstance({
    model,
    providerSettings: llmManager.getConfiguredProviderSettings(),
  });

  return applyLanguageModelExecutionMode({
    model: languageModel,
    providerName: DEFAULT_PROVIDER.name,
    executionMode: options?.executionMode ?? 'default',
  });
};

export const getProviderByName = (providerName: string) => {
  return llmManager.getProviderByName(providerName);
};

export const getLanguageModelByProvider = (
  providerName: string,
  model: string,
  options?: { executionMode?: LanguageModelExecutionMode },
) => {
  const provider = getProviderByName(providerName);
  const languageModel = provider.getModelInstance({
    model,
    providerSettings: llmManager.getConfiguredProviderSettings(),
  });

  return applyLanguageModelExecutionMode({
    model: languageModel,
    providerName: provider.name,
    executionMode: options?.executionMode ?? 'default',
  });
};
