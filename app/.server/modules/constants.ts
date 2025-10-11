import { LLMManager } from '~/.server/modules/llm/manager.server';

const llmManager = LLMManager.getInstance();

export const DEFAULT_MODEL = llmManager.getDefaultModel();
export const MINOR_MODEL = llmManager.getMinorModel();
export const DEFAULT_PROVIDER = llmManager.getDefaultProvider();

export const DEFAULT_MODEL_DETAILS = DEFAULT_PROVIDER.staticModels.find((m) => m.name === DEFAULT_MODEL);
export const MINOR_MODEL_DETAILS = DEFAULT_PROVIDER.staticModels.find((m) => m.name === MINOR_MODEL);

export const getModel = (model: string) => {
  return DEFAULT_PROVIDER.getModelInstance({
    model,
    providerSettings: llmManager.getConfiguredProviderSettings(),
  });
};
