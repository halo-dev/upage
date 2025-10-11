import type { LanguageModel } from 'ai';
import { createOllama } from 'ollama-ai-provider-v2';
import { BaseProvider } from '~/.server/modules/llm/base-provider';
import type { ModelInfo } from '~/.server/modules/llm/types';
import type { IProviderSetting } from '~/types/model';
import { logger } from '~/utils/logger';

interface OllamaModelDetails {
  parent_model: string;
  format: string;
  family: string;
  families: string[];
  parameter_size: string;
  quantization_level: string;
}

export interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: OllamaModelDetails;
}

export interface OllamaApiResponse {
  models: OllamaModel[];
}

const BASE_URL = 'http://127.0.0.1:11434';

export default class OllamaProvider extends BaseProvider {
  name = 'Ollama';
  getApiKeyLink = 'https://ollama.com/download';
  labelForGetApiKey = 'Download Ollama';
  icon = 'i-ph:cloud-arrow-down';

  staticModels: ModelInfo[] = [];

  getDefaultNumCtx(): number {
    return process.env.DEFAULT_NUM_CTX ? parseInt(process.env.DEFAULT_NUM_CTX, 10) : 32768;
  }

  async getDynamicModels(settings?: IProviderSetting): Promise<ModelInfo[]> {
    let { baseUrl } = this.getProviderBaseUrlAndKey(settings);

    if (!baseUrl) {
      logger.debug('No baseUrl found for OLLAMA provider, using default: ', BASE_URL);
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

    const response = await fetch(`${baseUrl}/api/tags`);
    const data = (await response.json()) as OllamaApiResponse;

    // console.log({ ollamamodels: data.models });

    return data.models.map((model: OllamaModel) => ({
      name: model.name,
      label: `${model.name} (${model.details.parameter_size})`,
      provider: this.name,
      maxTokenAllowed: 8000,
    }));
  }

  getModelInstance: (options: { model: string; providerSettings?: Record<string, IProviderSetting> }) => LanguageModel =
    (options) => {
      const { providerSettings, model } = options;

      let { baseUrl } = this.getProviderBaseUrlAndKey(providerSettings?.[this.name]);

      // Backend: Check if we're running in Docker
      if (!baseUrl) {
        logger.debug('No baseUrl found for OLLAMA provider, using default: ', BASE_URL);
        baseUrl = BASE_URL;
      }

      const isDocker = process?.env?.RUNNING_IN_DOCKER === 'true';
      baseUrl = isDocker ? baseUrl.replace('localhost', 'host.docker.internal') : baseUrl;
      baseUrl = isDocker ? baseUrl.replace('127.0.0.1', 'host.docker.internal') : baseUrl;

      logger.debug('Ollama Base Url used: ', baseUrl);

      const ollama = createOllama({
        baseURL: `${baseUrl}/api`,
      });

      return ollama(model);
    };
}
