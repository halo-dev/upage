import { beforeEach, describe, expect, it, vi } from 'vitest';
import AtlasCloudProvider from './atlas-cloud';

const { createOpenAICompatible } = vi.hoisted(() => ({
  createOpenAICompatible: vi.fn(),
}));

vi.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible,
}));

describe('AtlasCloudProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    createOpenAICompatible.mockReset();
  });

  it('maps text generation models from the Atlas Cloud catalog', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: 'example/chat-model',
              object: 'model',
              context_length: 128000,
              max_output_length: 32000,
              output_modalities: ['text'],
            },
            {
              id: 'example/image-model',
              object: 'model',
              context_length: 4096,
              output_modalities: ['image'],
            },
          ],
        }),
      ),
    );

    const provider = new AtlasCloudProvider();
    const models = await provider.getDynamicModels({ apiKey: 'test-key' });

    expect(fetch).toHaveBeenCalledWith('https://api.atlascloud.ai/v1/models', {
      headers: { Authorization: 'Bearer test-key' },
    });
    expect(models).toEqual([
      {
        name: 'example/chat-model',
        label: 'example/chat-model - context 128k',
        provider: 'Atlas Cloud',
        maxTokenAllowed: 32000,
      },
    ]);
  });

  it('uses the configured base URL for model instances', () => {
    const modelInstance = {};
    const createModel = vi.fn().mockReturnValue(modelInstance);
    createOpenAICompatible.mockReturnValue(createModel);

    const provider = new AtlasCloudProvider();
    const result = provider.getModelInstance({
      model: 'example/chat-model',
      providerSettings: {
        'Atlas Cloud': {
          apiKey: 'test-key',
          baseUrl: 'https://example.com/v1/',
        },
      },
    });

    expect(createOpenAICompatible).toHaveBeenCalledWith({
      name: 'atlas-cloud',
      baseURL: 'https://example.com/v1',
      apiKey: 'test-key',
      includeUsage: true,
    });
    expect(createModel).toHaveBeenCalledWith('example/chat-model');
    expect(result).toBe(modelInstance);
  });

  it('requires an API key', async () => {
    const provider = new AtlasCloudProvider();

    await expect(provider.getDynamicModels()).rejects.toThrow('Missing API key for Atlas Cloud provider');
    expect(() => provider.getModelInstance({ model: 'example/chat-model' })).toThrow(
      'Missing API key for Atlas Cloud provider',
    );
  });
});
