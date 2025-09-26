import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import { logger } from '~/utils/logger';

export default class LMStudioProvider extends BaseProvider {
  name = 'LMStudio';
  getApiKeyLink = 'https://lmstudio.ai/';
  labelForGetApiKey = 'Get LMStudio';
  icon = 'i-ph:cloud-arrow-down';

  config = {
    baseUrlKey: 'LMSTUDIO_API_BASE_URL',
    baseUrl: 'http://127.0.0.1:1234/',
  };

  staticModels: ModelInfo[] = [];

  async getDynamicModels(apiKeys?: Record<string, string>, settings?: IProviderSetting): Promise<ModelInfo[]> {
    let { baseUrl } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      defaultBaseUrlKey: 'LMSTUDIO_API_BASE_URL',
      defaultApiTokenKey: '',
    });

    if (!baseUrl) {
      throw new Error('No baseUrl found for LMStudio provider');
    }

    if (typeof window === 'undefined') {
      /*
       * Running in Server
       * Backend: Check if we're running in Docker
       */
      const isDocker = process?.env?.RUNNING_IN_DOCKER === 'true';

      baseUrl = isDocker ? baseUrl.replace('localhost', 'host.docker.internal') : baseUrl;
      baseUrl = isDocker ? baseUrl.replace('127.0.0.1', 'host.docker.internal') : baseUrl;
    }

    const response = await fetch(`${baseUrl}/v1/models`);
    const data = (await response.json()) as { data: Array<{ id: string }> };

    return data.data.map((model) => ({
      name: model.id,
      label: model.id,
      provider: this.name,
      maxTokenAllowed: 8000,
    }));
  }
  getModelInstance: (options: {
    model: string;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }) => LanguageModel = (options) => {
    const { apiKeys, providerSettings, model } = options;
    let { baseUrl } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      defaultBaseUrlKey: 'LMSTUDIO_API_BASE_URL',
      defaultApiTokenKey: '',
    });

    if (!baseUrl) {
      throw new Error('No baseUrl found for LMStudio provider');
    }

    const isDocker = process?.env?.RUNNING_IN_DOCKER === 'true';

    if (typeof window === 'undefined') {
      baseUrl = isDocker ? baseUrl.replace('localhost', 'host.docker.internal') : baseUrl;
      baseUrl = isDocker ? baseUrl.replace('127.0.0.1', 'host.docker.internal') : baseUrl;
    }

    logger.debug('LMStudio Base Url used: ', baseUrl);

    const lmstudio = createOpenAI({
      baseURL: `${baseUrl}/v1`,
      apiKey: '',
    });

    return lmstudio(model);
  };
}
