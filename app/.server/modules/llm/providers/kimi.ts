import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import { BaseProvider } from '~/.server/modules/llm/base-provider';
import { createVisionCapabilities } from '~/.server/modules/llm/capabilities';
import type { ModelInfo } from '~/.server/modules/llm/types';
import type { IProviderSetting } from '~/types/model';

function shouldDisableThinking(body: { tool_choice?: unknown; tools?: unknown }): boolean {
  if (Array.isArray(body.tools) && body.tools.length > 0) {
    return true;
  }

  const { tool_choice: toolChoice } = body;

  if (toolChoice === 'required') {
    return true;
  }

  if (typeof toolChoice !== 'object' || toolChoice === null) {
    return false;
  }

  const choice = toolChoice as {
    type?: unknown;
  };

  return choice.type === 'function';
}

export default class KimiProvider extends BaseProvider {
  name = 'Kimi';
  getApiKeyLink = undefined;
  resolveModelCapabilities = () => createVisionCapabilities('declared');

  staticModels: ModelInfo[] = [];

  async getDynamicModels(settings?: IProviderSetting): Promise<ModelInfo[]> {
    const { baseUrl: fetchBaseUrl, apiKey } = this.getProviderBaseUrlAndKey(settings);
    const baseUrl = fetchBaseUrl || 'https://api.moonshot.cn/v1';

    if (!apiKey) {
      throw `Missing Api Key configuration for ${this.name} provider`;
    }

    const response = await fetch(`${baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    const res = (await response.json()) as any;

    const data = res.data.filter((model: any) => model.object === 'model' && model.supports_chat);

    return data.map((m: any) => ({
      name: m.id,
      label: `${m.id} - context ${m.context_length ? Math.floor(m.context_length / 1000) + 'k' : 'N/A'}`,
      provider: this.name,
      maxTokenAllowed: m.context_length || 8000,
    }));
  }

  getModelInstance(options: { model: string; providerSettings?: Record<string, IProviderSetting> }): LanguageModel {
    const { model, providerSettings } = options;

    const { apiKey } = this.getProviderBaseUrlAndKey(providerSettings?.[this.name]);

    if (!apiKey) {
      throw `Missing Api Key configuration for ${this.name} provider`;
    }

    const provider = createOpenAICompatible({
      name: this.name,
      baseURL: 'https://api.moonshot.cn/v1',
      apiKey,
      includeUsage: true,
      transformRequestBody: (body) => {
        if (!shouldDisableThinking(body)) {
          return body;
        }

        return {
          ...body,
          thinking: { type: 'disabled' },
        };
      },
    });

    return provider(model);
  }
}
