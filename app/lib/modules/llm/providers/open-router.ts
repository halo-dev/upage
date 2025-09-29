import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { LanguageModel } from 'ai';
import { BaseProvider } from '~/lib/modules/llm/base-provider';
import type { ModelInfo } from '~/lib/modules/llm/types';
import type { IProviderSetting } from '~/types/model';

interface OpenRouterModel {
  name: string;
  id: string;
  context_length: number;
  pricing: {
    prompt: number;
    completion: number;
  };
}

interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

export default class OpenRouterProvider extends BaseProvider {
  name = 'OpenRouter';
  getApiKeyLink = 'https://openrouter.ai/settings/keys';

  staticModels: ModelInfo[] = [
    {
      name: 'anthropic/claude-3.5-sonnet',
      label: 'Anthropic: Claude 3.5 Sonnet (OpenRouter)',
      provider: 'OpenRouter',
      maxTokenAllowed: 8000,
    },
    {
      name: 'anthropic/claude-3-haiku',
      label: 'Anthropic: Claude 3 Haiku (OpenRouter)',
      provider: 'OpenRouter',
      maxTokenAllowed: 8000,
    },
    {
      name: 'deepseek/deepseek-coder',
      label: 'DeepSeek-Coder V2 236B (OpenRouter)',
      provider: 'OpenRouter',
      maxTokenAllowed: 8000,
    },
    {
      name: 'google/gemini-flash-1.5',
      label: 'Google Gemini Flash 1.5 (OpenRouter)',
      provider: 'OpenRouter',
      maxTokenAllowed: 8000,
    },
    {
      name: 'google/gemini-pro-1.5',
      label: 'Google Gemini Pro 1.5 (OpenRouter)',
      provider: 'OpenRouter',
      maxTokenAllowed: 8000,
    },
    { name: 'x-ai/grok-beta', label: 'xAI Grok Beta (OpenRouter)', provider: 'OpenRouter', maxTokenAllowed: 8000 },
    {
      name: 'mistralai/mistral-nemo',
      label: 'OpenRouter Mistral Nemo (OpenRouter)',
      provider: 'OpenRouter',
      maxTokenAllowed: 8000,
    },
    {
      name: 'qwen/qwen-110b-chat',
      label: 'OpenRouter Qwen 110b Chat (OpenRouter)',
      provider: 'OpenRouter',
      maxTokenAllowed: 8000,
    },
    { name: 'cohere/command', label: 'Cohere Command (OpenRouter)', provider: 'OpenRouter', maxTokenAllowed: 4096 },
  ];

  async getDynamicModels(_settings?: IProviderSetting, _serverEnv: Record<string, string> = {}): Promise<ModelInfo[]> {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = (await response.json()) as OpenRouterModelsResponse;

      return data.data
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((m) => ({
          name: m.id,
          label: `${m.name} - in:$${(m.pricing.prompt * 1_000_000).toFixed(2)} out:$${(m.pricing.completion * 1_000_000).toFixed(2)} - context ${Math.floor(m.context_length / 1000)}k`,
          provider: this.name,
          maxTokenAllowed: 8000,
        }));
    } catch (error) {
      console.error('Error getting OpenRouter models:', error);
      return [];
    }
  }

  getModelInstance(options: { model: string; providerSettings?: Record<string, IProviderSetting> }): LanguageModel {
    const { model, providerSettings } = options;

    const { apiKey } = this.getProviderBaseUrlAndKey(providerSettings?.[this.name]);

    if (!apiKey) {
      throw new Error(`Missing API key for ${this.name} provider`);
    }

    const openRouter = createOpenRouter({
      apiKey,
    });

    return openRouter.chat(model);
  }
}
