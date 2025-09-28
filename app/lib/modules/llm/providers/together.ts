import type { LanguageModel } from 'ai';
import { BaseProvider, getOpenAILikeModel } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';

export default class TogetherProvider extends BaseProvider {
  name = 'Together';
  getApiKeyLink = 'https://api.together.xyz/settings/api-keys';

  staticModels: ModelInfo[] = [
    {
      name: 'Qwen/Qwen2.5-Coder-32B-Instruct',
      label: 'Qwen/Qwen2.5-Coder-32B-Instruct',
      provider: 'Together',
      maxTokenAllowed: 8000,
    },
    {
      name: 'meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo',
      label: 'meta-llama/Llama-3.2-90B-Vision-Instruct-Turbo',
      provider: 'Together',
      maxTokenAllowed: 8000,
    },
    {
      name: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
      label: 'Mixtral 8x7B Instruct',
      provider: 'Together',
      maxTokenAllowed: 8192,
    },
  ];

  async getDynamicModels(settings?: IProviderSetting): Promise<ModelInfo[]> {
    const { baseUrl: fetchBaseUrl, apiKey } = this.getProviderBaseUrlAndKey(settings);
    const baseUrl = fetchBaseUrl || 'https://api.together.xyz/v1';

    if (!baseUrl || !apiKey) {
      return [];
    }

    // console.log({ baseUrl, apiKey });

    const response = await fetch(`${baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const res = (await response.json()) as any;
    const data = (res || []).filter((model: any) => model.type === 'chat');

    return data.map((m: any) => ({
      name: m.id,
      label: `${m.display_name} - in:$${m.pricing.input.toFixed(2)} out:$${m.pricing.output.toFixed(2)} - context ${Math.floor(m.context_length / 1000)}k`,
      provider: this.name,
      maxTokenAllowed: 8000,
    }));
  }

  getModelInstance(options: { model: string; providerSettings?: Record<string, IProviderSetting> }): LanguageModel {
    const { model, providerSettings } = options;

    const { baseUrl: fetchBaseUrl, apiKey } = this.getProviderBaseUrlAndKey(providerSettings?.[this.name]);
    const baseUrl = fetchBaseUrl || 'https://api.together.xyz/v1';

    if (!apiKey) {
      throw new Error(`Missing configuration for ${this.name} provider`);
    }

    return getOpenAILikeModel(baseUrl, apiKey, model);
  }
}
