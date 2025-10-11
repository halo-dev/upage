import { createDeepSeek } from '@ai-sdk/deepseek';
import type { LanguageModel } from 'ai';
import { BaseProvider } from '~/.server/modules/llm/base-provider';
import type { ModelInfo } from '~/.server/modules/llm/types';
import type { IProviderSetting } from '~/types/model';

export default class DeepseekProvider extends BaseProvider {
  name = 'DeepSeek';
  getApiKeyLink = 'https://platform.deepseek.com/apiKeys';

  config = {
    apiTokenKey: 'DEEPSEEK_API_KEY',
    baseUrlKey: '',
  };

  staticModels: ModelInfo[] = [
    { name: 'deepseek-coder', label: 'DeepSeek-Coder', provider: 'DeepSeek', maxTokenAllowed: 8000 },
    { name: 'deepseek-chat', label: 'DeepSeek-Chat', provider: 'DeepSeek', maxTokenAllowed: 8000 },
    { name: 'deepseek-reasoner', label: 'DeepSeek-Reasoner', provider: 'DeepSeek', maxTokenAllowed: 8000 },
  ];

  getModelInstance(options: { model: string; providerSettings?: Record<string, IProviderSetting> }): LanguageModel {
    const { model, providerSettings } = options;

    const { apiKey } = this.getProviderBaseUrlAndKey(providerSettings?.[this.name]);

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const deepseek = createDeepSeek({
      apiKey,
    });

    return deepseek(model);
  }
}
