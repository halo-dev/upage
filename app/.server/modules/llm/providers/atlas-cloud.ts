import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import { BaseProvider } from '~/.server/modules/llm/base-provider';
import type { ModelInfo } from '~/.server/modules/llm/types';
import type { IProviderSetting } from '~/types/model';

interface AtlasCloudModel {
  id: string;
  object?: string;
  context_length?: number;
  max_output_length?: number;
  output_modalities?: string[];
}

interface AtlasCloudModelsResponse {
  data?: AtlasCloudModel[];
}

const DEFAULT_BASE_URL = 'https://api.atlascloud.ai/v1';

export default class AtlasCloudProvider extends BaseProvider {
  name = 'Atlas Cloud';
  getApiKeyLink = 'https://www.atlascloud.ai/console/api-keys';

  staticModels: ModelInfo[] = [];

  async getDynamicModels(settings?: IProviderSetting): Promise<ModelInfo[]> {
    const { baseUrl: configuredBaseUrl, apiKey } = this.getProviderBaseUrlAndKey(settings);
    const baseUrl = configuredBaseUrl || DEFAULT_BASE_URL;

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const response = await fetch(`${baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${this.name} models: ${response.status} ${response.statusText}`);
    }

    const result = (await response.json()) as AtlasCloudModelsResponse;

    if (!Array.isArray(result.data)) {
      throw new Error(`Invalid models response from ${this.name}`);
    }

    return result.data
      .filter((model) => model.object === 'model' && model.output_modalities?.includes('text'))
      .map((model) => ({
        name: model.id,
        label: `${model.id} - context ${model.context_length ? `${Math.floor(model.context_length / 1000)}k` : 'N/A'}`,
        provider: this.name,
        maxTokenAllowed: model.max_output_length || model.context_length || 8000,
      }));
  }

  getModelInstance(options: { model: string; providerSettings?: Record<string, IProviderSetting> }): LanguageModel {
    const { model, providerSettings } = options;
    const { baseUrl: configuredBaseUrl, apiKey } = this.getProviderBaseUrlAndKey(providerSettings?.[this.name]);
    const baseUrl = configuredBaseUrl || DEFAULT_BASE_URL;

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const provider = createOpenAICompatible({
      name: 'atlas-cloud',
      baseURL: baseUrl,
      apiKey,
      includeUsage: true,
    });

    return provider(model);
  }
}
