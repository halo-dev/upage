import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import { BaseProvider } from '~/.server/modules/llm/base-provider';
import type { ModelInfo } from '~/.server/modules/llm/types';
import { logger } from '~/.server/utils/logger';
import type { IProviderSetting } from '~/types/model';

export const BASE_URL = 'http://127.0.0.1:1234/';
export default class LMStudioProvider extends BaseProvider {
  name = 'LMStudio';
  getApiKeyLink = 'https://lmstudio.ai/';
  labelForGetApiKey = 'Get LMStudio';
  icon = 'i-ph:cloud-arrow-down';

  staticModels: ModelInfo[] = [];

  async getDynamicModels(settings?: IProviderSetting): Promise<ModelInfo[]> {
    let { baseUrl } = this.getProviderBaseUrlAndKey(settings);

    if (!baseUrl) {
      logger.debug('未找到 LMStudio 提供者的 baseUrl，使用默认值: ', BASE_URL);
      baseUrl = BASE_URL;
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
  getModelInstance: (options: { model: string; providerSettings?: Record<string, IProviderSetting> }) => LanguageModel =
    (options) => {
      const { providerSettings, model } = options;
      let { baseUrl } = this.getProviderBaseUrlAndKey(providerSettings?.[this.name]);

      if (!baseUrl) {
        logger.debug('未找到 LMStudio 提供者的 baseUrl，使用默认值: ', BASE_URL);
        baseUrl = BASE_URL;
      }

      const isDocker = process?.env?.RUNNING_IN_DOCKER === 'true';

      if (typeof window === 'undefined') {
        baseUrl = isDocker ? baseUrl.replace('localhost', 'host.docker.internal') : baseUrl;
        baseUrl = isDocker ? baseUrl.replace('127.0.0.1', 'host.docker.internal') : baseUrl;
      }

      logger.debug('LMStudio 使用的 baseUrl: ', baseUrl);

      const lmstudio = createOpenAI({
        baseURL: `${baseUrl}/v1`,
        apiKey: '',
      });

      return lmstudio(model);
    };
}
