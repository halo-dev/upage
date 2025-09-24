import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import type { IProviderSetting } from '~/types/model';
import type { ModelInfo, ProviderConfig, ProviderInfo } from './types';

export abstract class BaseProvider implements ProviderInfo {
  abstract name: string;
  abstract staticModels: ModelInfo[];
  abstract config: ProviderConfig;
  cachedDynamicModels?: {
    cacheId: string;
    models: ModelInfo[];
  };

  getApiKeyLink?: string;
  labelForGetApiKey?: string;
  icon?: string;

  getProviderBaseUrlAndKey(options: {
    apiKeys?: Record<string, string>;
    providerSettings?: IProviderSetting;
    defaultBaseUrlKey: string;
    defaultApiTokenKey: string;
  }) {
    const { apiKeys, providerSettings, defaultBaseUrlKey, defaultApiTokenKey } = options;
    let settingsBaseUrl = providerSettings?.baseUrl;

    if (settingsBaseUrl && settingsBaseUrl.length == 0) {
      settingsBaseUrl = undefined;
    }

    const baseUrlKey = this.config.baseUrlKey || defaultBaseUrlKey;
    let baseUrl =
      settingsBaseUrl || process?.env?.[baseUrlKey] || (import.meta.env as any)?.[baseUrlKey] || this.config.baseUrl;

    if (baseUrl && baseUrl.endsWith('/')) {
      baseUrl = baseUrl.slice(0, -1);
    }

    const apiTokenKey = this.config.apiTokenKey || defaultApiTokenKey;
    const apiKey = apiKeys?.[this.name] || process?.env?.[apiTokenKey] || (import.meta.env as any)?.[apiTokenKey];

    return {
      baseUrl,
      apiKey,
    };
  }
  getModelsFromCache(options: {
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): ModelInfo[] | null {
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
  getDynamicModelsCacheKey(options: {
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }) {
    return JSON.stringify({
      apiKeys: options.apiKeys?.[this.name],
      providerSettings: options.providerSettings?.[this.name],
    });
  }
  storeDynamicModels(
    options: {
      apiKeys?: Record<string, string>;
      providerSettings?: Record<string, IProviderSetting>;
    },
    models: ModelInfo[],
  ) {
    const cacheId = this.getDynamicModelsCacheKey(options);

    // console.log('caching dynamic models',this.name,cacheId);
    this.cachedDynamicModels = {
      cacheId,
      models,
    };
  }

  // Declare the optional getDynamicModels method
  getDynamicModels?(apiKeys?: Record<string, string>, settings?: IProviderSetting): Promise<ModelInfo[]>;

  abstract getModelInstance(options: {
    model: string;
    apiKeys?: Record<string, string>;
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
