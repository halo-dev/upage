import { createScopedLogger } from '~/.server/utils/logger';
import type { IProviderSetting } from '~/types/model';
import { BaseProvider } from './base-provider';
import * as providers from './registry';
import type { ModelInfo, ProviderInfo } from './types';

const logger = createScopedLogger('LLMManager');

export class LLMManager {
  private static _instance: LLMManager;
  private _providers: Map<string, BaseProvider> = new Map();
  private _modelList: ModelInfo[] = [];

  constructor() {
    this._registerProvidersFromDirectory();
  }

  static getInstance(): LLMManager {
    if (!LLMManager._instance) {
      LLMManager._instance = new LLMManager();
    }

    return LLMManager._instance;
  }

  private _getEnvConfig<T>(key: string, defaultValue: T): T {
    const value = process?.env?.[key] || (import.meta.env as any)?.[key];

    if (value === undefined || value === null || value === '') {
      return defaultValue;
    }

    if (typeof defaultValue === 'boolean') {
      return (value === 'true' || value === true) as unknown as T;
    }

    if (typeof defaultValue === 'number') {
      return Number(value) as unknown as T;
    }

    if (Array.isArray(defaultValue)) {
      return (value
        ? String(value)
            .split(',')
            .map((item) => item.trim())
        : []) as unknown as T;
    }

    return value as T;
  }

  private _getUnifiedProviderConfig() {
    const providerName = this._getEnvConfig<string>('LLM_PROVIDER', '');
    const baseUrl = this._getEnvConfig<string>('PROVIDER_BASE_URL', '');
    const apiKey = this._getEnvConfig<string>('PROVIDER_API_KEY', '');

    return {
      providerName,
      baseUrl,
      apiKey,
    };
  }

  getDefaultProvider(): BaseProvider {
    const { providerName } = this._getUnifiedProviderConfig();

    if (!providerName || !this._providers.has(providerName)) {
      throw new Error(
        `Provider ${providerName} not found, Effective Provider: ${Array.from(this._providers.values())
          .map((p) => p.name)
          .join(', ')}`,
      );
    }

    return this._providers.get(providerName)!;
  }

  private _registerProvidersFromDirectory() {
    const allProviders: BaseProvider[] = Object.values(providers).map((providerClass) => new providerClass());
    for (const provider of allProviders) {
      this.registerProvider(provider);
    }
  }

  registerProvider(provider: BaseProvider) {
    if (this._providers.has(provider.name)) {
      logger.warn(`Provider ${provider.name} is already registered. Skipping.`);
      return;
    }

    this._providers.set(provider.name, provider);
    this._modelList = [...this._modelList, ...provider.staticModels];
  }

  getDefaultModel(): string {
    return this._getEnvConfig<string>('LLM_DEFAULT_MODEL', '');
  }

  getMinorModel(): string {
    return this._getEnvConfig<string>('LLM_MINOR_MODEL', '');
  }

  getConfiguredProviderSettings(): Record<string, IProviderSetting> {
    const providerSettings: Record<string, IProviderSetting> = {};

    const { providerName, baseUrl, apiKey } = this._getUnifiedProviderConfig();

    providerSettings[providerName] = {
      enabled: true,
      baseUrl,
      apiKey,
    };
    return providerSettings;
  }

  getModelList(): ModelInfo[] {
    return this._modelList;
  }

  async updateModelList(options: { providerSettings?: Record<string, IProviderSetting> }): Promise<ModelInfo[]> {
    const { providerSettings } = options;

    let enabledProviders = Array.from(this._providers.values()).map((p) => p.name);

    if (providerSettings && Object.keys(providerSettings).length > 0) {
      enabledProviders = enabledProviders.filter((p) => providerSettings[p]?.enabled);
    }

    // Get dynamic models from all providers that support them
    const dynamicModels = await Promise.all(
      Array.from(this._providers.values())
        .filter((provider) => enabledProviders.includes(provider.name))
        .filter(
          (provider): provider is BaseProvider & Required<Pick<ProviderInfo, 'getDynamicModels'>> =>
            !!provider.getDynamicModels,
        )
        .map(async (provider) => {
          const cachedModels = provider.getModelsFromCache(options);

          if (cachedModels) {
            return cachedModels;
          }

          const dynamicModels = await provider
            .getDynamicModels(providerSettings?.[provider.name])
            .then((models) => {
              logger.info(`Caching ${models.length} dynamic models for ${provider.name}`);
              provider.storeDynamicModels(options, models);

              return models;
            })
            .catch((err) => {
              logger.error(`Error getting dynamic models ${provider.name} :`, err);
              return [];
            });

          return dynamicModels;
        }),
    );
    const staticModels = Array.from(this._providers.values()).flatMap((p) => p.staticModels || []);
    const dynamicModelsFlat = dynamicModels.flat();
    const dynamicModelKeys = dynamicModelsFlat.map((d) => `${d.name}-${d.provider}`);
    const filteredStaticModesl = staticModels.filter((m) => !dynamicModelKeys.includes(`${m.name}-${m.provider}`));

    // Combine static and dynamic models
    const modelList = [...dynamicModelsFlat, ...filteredStaticModesl];
    modelList.sort((a, b) => a.name.localeCompare(b.name));
    this._modelList = modelList;

    return modelList;
  }
  getStaticModelList() {
    return [...this._providers.values()].flatMap((p) => p.staticModels || []);
  }
  async getModelListFromProvider(
    providerArg: BaseProvider,
    options: {
      providerSettings?: Record<string, IProviderSetting>;
    },
  ): Promise<ModelInfo[]> {
    const provider = this._providers.get(providerArg.name);

    if (!provider) {
      throw new Error(`Provider ${providerArg.name} not found`);
    }

    const staticModels = provider.staticModels || [];

    if (!provider.getDynamicModels) {
      return staticModels;
    }

    const { providerSettings } = options;

    const cachedModels = provider.getModelsFromCache({
      providerSettings,
    });

    if (cachedModels) {
      logger.info(`Found ${cachedModels.length} cached models for ${provider.name}`);
      return [...cachedModels, ...staticModels];
    }

    logger.info(`Getting dynamic models for ${provider.name}`);

    const dynamicModels = await provider
      .getDynamicModels?.(providerSettings?.[provider.name])
      .then((models) => {
        logger.info(`Got ${models.length} dynamic models for ${provider.name}`);
        provider.storeDynamicModels(options, models);

        return models;
      })
      .catch((err) => {
        logger.error(`Error getting dynamic models ${provider.name} :`, err);
        return [];
      });
    const dynamicModelsName = dynamicModels.map((d) => d.name);
    const filteredStaticList = staticModels.filter((m) => !dynamicModelsName.includes(m.name));
    const modelList = [...dynamicModels, ...filteredStaticList];
    modelList.sort((a, b) => a.name.localeCompare(b.name));

    return modelList;
  }
  getStaticModelListFromProvider(providerArg: BaseProvider) {
    const provider = this._providers.get(providerArg.name);

    if (!provider) {
      throw new Error(`Provider ${providerArg.name} not found`);
    }

    return [...(provider.staticModels || [])];
  }
}
