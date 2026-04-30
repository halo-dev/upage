import type { LanguageModel } from 'ai';
import type { IProviderSetting } from '~/types/model';
import type { ModelCapabilities } from './capabilities';

export interface ModelInfo {
  name: string;
  label: string;
  provider: string;
  maxTokenAllowed: number;
}

export interface ProviderInfo {
  name: string;
  staticModels: ModelInfo[];
  getDynamicModels?: (apiKeys?: Record<string, string>, settings?: IProviderSetting) => Promise<ModelInfo[]>;
  getModelInstance: (options: {
    model: string;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }) => LanguageModel;
  getApiKeyLink?: string;
  labelForGetApiKey?: string;
  icon?: string;
  resolveModelCapabilities?: (model: string) => ModelCapabilities | Partial<ModelCapabilities> | null | undefined;
}
export interface ProviderConfig {
  baseUrlKey?: string;
  apiTokenKey?: string;
}
