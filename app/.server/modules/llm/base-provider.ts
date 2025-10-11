import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import type { IProviderSetting } from '~/types/model';
import type { ModelInfo, ProviderInfo } from './types';

export abstract class BaseProvider implements ProviderInfo {
  abstract name: string;
  abstract staticModels: ModelInfo[];
  cachedDynamicModels?: {
    cacheId: string;
    models: ModelInfo[];
  };

  getApiKeyLink?: string;
  labelForGetApiKey?: string;
  icon?: string;

  getProviderBaseUrlAndKey(providerSettings?: IProviderSetting) {
    let baseUrl = providerSettings?.baseUrl;
    if (baseUrl && baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1);
    }

    const apiKey = providerSettings?.apiKey;

    return {
      baseUrl,
      apiKey,
    };
  }

  getModelsFromCache(options: { providerSettings?: Record<string, IProviderSetting> }): ModelInfo[] | null {
    if (!this.cachedDynamicModels) {
      // console.log('no dynamic models',this.name);
      return null;
    }

    const cacheKey = this.cachedDynamicModels.cacheId;
    const generatedCacheKey = this.getDynamicModelsCacheKey(options);

    if (cacheKey !== generatedCacheKey) {
      // console.log('cache key mismatch',this.name,cacheKey,generatedCacheKey);
      this.cachedDynamicModels = undefined;
      return null;
    }

    return this.cachedDynamicModels.models;
  }
  getDynamicModelsCacheKey(options: { providerSettings?: Record<string, IProviderSetting> }) {
    return JSON.stringify({
      apiKeys: options.providerSettings?.[this.name]?.apiKey,
      providerSettings: options.providerSettings?.[this.name],
    });
  }
  storeDynamicModels(options: { providerSettings?: Record<string, IProviderSetting> }, models: ModelInfo[]) {
    const cacheId = this.getDynamicModelsCacheKey(options);

    // console.log('caching dynamic models',this.name,cacheId);
    this.cachedDynamicModels = {
      cacheId,
      models,
    };
  }

  // Declare the optional getDynamicModels method
  getDynamicModels?(settings?: IProviderSetting): Promise<ModelInfo[]>;

  abstract getModelInstance(options: {
    model: string;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModel;
}

type OptionalApiKey = string | undefined;

export function getOpenAILikeModel(baseURL: string, apiKey: OptionalApiKey, model: string) {
  const openai = createOpenAI({
    baseURL,
    apiKey,
  });

  return openai(model);
}
