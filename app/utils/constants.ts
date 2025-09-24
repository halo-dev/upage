import { LLMManager } from '~/lib/modules/llm/manager';

export const WORK_DIR_NAME = 'project';
export const MODEL_REGEX = /^\[Model: (.*?)\]\n\n/;
export const PROVIDER_REGEX = /\[Provider: (.*?)\]\n\n/;

const llmManager = LLMManager.getInstance();

export const DEFAULT_MODEL = llmManager.getDefaultModel();
export const MINOR_MODEL = llmManager.getMinorModel();
export const PROVIDER_LIST = llmManager.getAllProviders();
export const DEFAULT_PROVIDER = llmManager.getDefaultProvider();

export const DEFAULT_MODEL_DETAILS = DEFAULT_PROVIDER.staticModels.find((m) => m.name === DEFAULT_MODEL);
export const MINOR_MODEL_DETAILS = DEFAULT_PROVIDER.staticModels.find((m) => m.name === MINOR_MODEL);

export const providerBaseUrlEnvKeys: Record<string, { baseUrlKey?: string; apiTokenKey?: string }> = {};
PROVIDER_LIST.forEach((provider) => {
  providerBaseUrlEnvKeys[provider.name] = {
    baseUrlKey: provider.config.baseUrlKey,
    apiTokenKey: provider.config.apiTokenKey,
  };
});

export const getModel = (model: string) => {
  return DEFAULT_PROVIDER.getModelInstance({
    model,
    apiKeys: llmManager.getConfiguredApiKeys(),
    providerSettings: llmManager.getConfiguredProviderSettings(),
  });
};
