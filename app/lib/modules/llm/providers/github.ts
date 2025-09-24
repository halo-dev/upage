import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';

export default class GithubProvider extends BaseProvider {
  name = 'Github';
  getApiKeyLink = 'https://github.com/settings/personal-access-tokens';

  config = {
    apiTokenKey: 'GITHUB_API_KEY',
  };

  // find more in https://github.com/marketplace?type=models
  staticModels: ModelInfo[] = [
    { name: 'gpt-4o', label: 'GPT-4o', provider: 'Github', maxTokenAllowed: 8000 },
    { name: 'o1', label: 'o1-preview', provider: 'Github', maxTokenAllowed: 100000 },
    { name: 'o1-mini', label: 'o1-mini', provider: 'Github', maxTokenAllowed: 8000 },
    { name: 'gpt-4o-mini', label: 'GPT-4o Mini', provider: 'Github', maxTokenAllowed: 8000 },
    { name: 'gpt-4-turbo', label: 'GPT-4 Turbo', provider: 'Github', maxTokenAllowed: 8000 },
    { name: 'gpt-4', label: 'GPT-4', provider: 'Github', maxTokenAllowed: 8000 },
    { name: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', provider: 'Github', maxTokenAllowed: 8000 },
  ];

  getModelInstance(options: {
    model: string;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModel {
    const { model, apiKeys, providerSettings } = options;

    const { apiKey } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      defaultBaseUrlKey: '',
      defaultApiTokenKey: 'GITHUB_API_KEY',
    });

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const openai = createOpenAI({
      baseURL: 'https://models.inference.ai.azure.com',
      apiKey,
    });

    return openai(model);
  }
}
