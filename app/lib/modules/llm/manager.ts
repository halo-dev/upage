import type { IProviderSetting } from '~/types/model';
import { createScopedLogger } from '~/utils/logger';
import { BaseProvider } from './base-provider';
import * as providers from './registry';
import type { ModelInfo, ProviderInfo } from './types';

const logger = createScopedLogger('LLMManager');
export class LLMManager {
  private static _instance: LLMManager;
  private _providers: Map<string, BaseProvider> = new Map();
  private _modelList: ModelInfo[] = [];

  private constructor() {
    this._registerProvidersFromDirectory();
  }

  static getInstance(): LLMManager {
    if (!LLMManager._instance) {
      LLMManager._instance = new LLMManager();
    }

    return LLMManager._instance;
  }

  // 从环境变量中读取配置的辅助方法
  private _getEnvConfig<T>(key: string, defaultValue: T): T {
    const value = process?.env?.[key] || (import.meta.env as any)?.[key];

    if (value === undefined || value === null || value === '') {
      return defaultValue;
    }

    if (typeof defaultValue === 'boolean') {
      return (value === 'true' || value === true) as unknown as T;
    } else if (typeof defaultValue === 'number') {
      return Number(value) as unknown as T;
    } else if (Array.isArray(defaultValue)) {
      return (value
        ? String(value)
            .split(',')
            .map((item) => item.trim())
        : []) as unknown as T;
    }

    return value as T;
  }

  private _registerProvidersFromDirectory() {
    const allProviders: BaseProvider[] = Object.values(providers).map((providerClass) => new providerClass());

    // 获取环境变量中的启用提供商列表
    const enabledProviders = this._getEnvConfig<string[]>('LLM_ENABLED_PROVIDERS', []);

    // 过滤提供商，仅保留配置中启用的提供商
    const filteredProviders =
      enabledProviders.length > 0
        ? allProviders.filter((provider) => enabledProviders.includes(provider.name))
        : allProviders;

    for (const provider of filteredProviders) {
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

  getProvider(name: string): BaseProvider | undefined {
    return this._providers.get(name);
  }

  getAllProviders(): BaseProvider[] {
    return Array.from(this._providers.values());
  }

  getDefaultProvider(): BaseProvider {
    const defaultProviderName = this._getEnvConfig<string>('LLM_DEFAULT_PROVIDER', '');

    if (defaultProviderName && this._providers.has(defaultProviderName)) {
      return this._providers.get(defaultProviderName)!;
    }

    return Array.from(this._providers.values())[0];
  }

  getDefaultModel(): string {
    return this._getEnvConfig<string>('LLM_DEFAULT_MODEL', '');
  }

  getMinorModel(): string {
    return this._getEnvConfig<string>('LLM_MINOR_MODEL', '');
  }

  getConfiguredApiKeys(): Record<string, string> {
    const apiKeys: Record<string, string> = {};

    const allProviders = this.getAllProviders();

    for (const provider of allProviders) {
      if (!provider.config.apiTokenKey) {
        continue;
      }

      const apiTokenKey = provider.config.apiTokenKey;

      const apiKey = process?.env?.[apiTokenKey] || (import.meta.env as any)?.[apiTokenKey];

      if (apiKey) {
        apiKeys[provider.name] = apiKey;
        logger.debug(`Found API key for provider ${provider.name} in environment variables`);
      }
    }

    return apiKeys;
  }

  getConfiguredProviderSettings(): Record<string, IProviderSetting> {
    const providerSettings: Record<string, IProviderSetting> = {};

    // 获取所有注册的提供商
    const allProviders = this.getAllProviders();

    for (const provider of allProviders) {
      const providerName = provider.name;
      const settings: IProviderSetting = { enabled: true };

      if (provider.config.baseUrlKey) {
        const baseUrlKey = provider.config.baseUrlKey;
        const baseUrl = process?.env?.[baseUrlKey] || (import.meta.env as any)?.[baseUrlKey];

        if (baseUrl) {
          settings.baseUrl = baseUrl;
          logger.debug(`Found base URL for provider ${providerName} in environment variables: ${baseUrl}`);
        }
      }

      const enabledKey = `${providerName.toUpperCase()}_ENABLED`;
      const isEnabled = this._getEnvConfig<boolean>(enabledKey, true);
      settings.enabled = isEnabled;

      if (Object.keys(settings).length > 1 || settings.enabled === false) {
        providerSettings[providerName] = settings;
      }
    }

    return providerSettings;
  }

  getModelList(): ModelInfo[] {
    return this._modelList;
  }

  async updateModelList(options: {
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): Promise<ModelInfo[]> {
    const { apiKeys, providerSettings } = options;

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
            .getDynamicModels(apiKeys, providerSettings?.[provider.name])
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
      apiKeys?: Record<string, string>;
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

    const { apiKeys, providerSettings } = options;

    const cachedModels = provider.getModelsFromCache({
      apiKeys,
      providerSettings,
    });

    if (cachedModels) {
      logger.info(`Found ${cachedModels.length} cached models for ${provider.name}`);
      return [...cachedModels, ...staticModels];
    }

    logger.info(`Getting dynamic models for ${provider.name}`);

    const dynamicModels = await provider
      .getDynamicModels?.(apiKeys, providerSettings?.[provider.name])
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
