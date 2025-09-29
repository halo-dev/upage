import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';

export default class OpenAILikeProvider extends BaseProvider {
  name = 'OpenAI';
  getApiKeyLink = undefined;

  staticModels: ModelInfo[] = [];

  async getDynamicModels(settings?: IProviderSetting): Promise<ModelInfo[]> {
    const { baseUrl, apiKey } = this.getProviderBaseUrlAndKey(settings);

    if (!baseUrl || !apiKey) {
      return [];
    }

    const response = await fetch(`${baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const res = (await response.json()) as any;

    return res.data.map((model: any) => ({
      name: model.id,
      label: model.id,
      provider: this.name,
      maxTokenAllowed: 8000,
    }));
  }

  getModelInstance(options: { model: string; providerSettings?: Record<string, IProviderSetting> }): LanguageModel {
    const { model, providerSettings } = options;

    const { baseUrl, apiKey } = this.getProviderBaseUrlAndKey(providerSettings?.[this.name]);

    if (!apiKey) {
      throw new Error(`Missing configuration for ${this.name} provider`);
    }

    let openaiBaseUrl = baseUrl;
    if (!baseUrl) {
      openaiBaseUrl = undefined;
    }

    const openai = createOpenAI({
      baseURL: openaiBaseUrl,
      apiKey,
    });

    return openai(model);
  }
}
