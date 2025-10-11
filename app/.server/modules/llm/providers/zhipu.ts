import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import { BaseProvider } from '~/.server/modules/llm/base-provider';
import type { ModelInfo } from '~/.server/modules/llm/types';
import type { IProviderSetting } from '~/types/model';

export default class ZhiPuProvider extends BaseProvider {
  name = 'ZhiPu';
  getApiKeyLink = undefined;

  staticModels: ModelInfo[] = [];

  async getDynamicModels(settings?: IProviderSetting): Promise<ModelInfo[]> {
    const { baseUrl: fetchBaseUrl, apiKey } = this.getProviderBaseUrlAndKey(settings);
    const baseUrl = fetchBaseUrl || 'https://open.bigmodel.cn/api/paas/v4';

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

    const openai = createOpenAICompatible({
      name: this.name,
      baseURL: 'https://open.bigmodel.cn/api/paas/v4',
      apiKey,
      includeUsage: true,
    });

    return openai(model);
  }
}
