import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';

export default class HyperbolicProvider extends BaseProvider {
  name = 'Hyperbolic';
  getApiKeyLink = 'https://app.hyperbolic.xyz/settings';

  staticModels: ModelInfo[] = [
    {
      name: 'Qwen/Qwen2.5-Coder-32B-Instruct',
      label: 'Qwen 2.5 Coder 32B Instruct',
      provider: 'Hyperbolic',
      maxTokenAllowed: 8192,
    },
    {
      name: 'Qwen/Qwen2.5-72B-Instruct',
      label: 'Qwen2.5-72B-Instruct',
      provider: 'Hyperbolic',
      maxTokenAllowed: 8192,
    },
    {
      name: 'deepseek-ai/DeepSeek-V2.5',
      label: 'DeepSeek-V2.5',
      provider: 'Hyperbolic',
      maxTokenAllowed: 8192,
    },
    {
      name: 'Qwen/QwQ-32B-Preview',
      label: 'QwQ-32B-Preview',
      provider: 'Hyperbolic',
      maxTokenAllowed: 8192,
    },
    {
      name: 'Qwen/Qwen2-VL-72B-Instruct',
      label: 'Qwen2-VL-72B-Instruct',
      provider: 'Hyperbolic',
      maxTokenAllowed: 8192,
    },
  ];

  async getDynamicModels(settings?: IProviderSetting): Promise<ModelInfo[]> {
    const { baseUrl: fetchBaseUrl, apiKey } = this.getProviderBaseUrlAndKey(settings);
    const baseUrl = fetchBaseUrl || 'https://api.hyperbolic.xyz/v1';

    if (!apiKey) {
      throw `Missing Api Key configuration for ${this.name} provider`;
    }

    const response = await fetch(`${baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const res = (await response.json()) as any;

    const data = res.data.filter((model: any) => model.object === 'model' && model.supports_chat);

    return data.map((m: any) => ({
      name: m.id,
      label: `${m.id} - context ${m.context_length ? Math.floor(m.context_length / 1000) + 'k' : 'N/A'}`,
      provider: this.name,
      maxTokenAllowed: m.context_length || 8000,
    }));
  }

  getModelInstance(options: { model: string; providerSettings?: Record<string, IProviderSetting> }): LanguageModel {
    const { model, providerSettings } = options;

    const { apiKey } = this.getProviderBaseUrlAndKey(providerSettings?.[this.name]);

    if (!apiKey) {
      throw `Missing Api Key configuration for ${this.name} provider`;
    }

    const openai = createOpenAI({
      baseURL: 'https://api.hyperbolic.xyz/v1/',
      apiKey,
    });

    return openai(model);
  }
}
