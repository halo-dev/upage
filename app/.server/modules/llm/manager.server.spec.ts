import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LLMManager } from './manager.server';

const originalEnv = { ...process.env };

describe('LLMManager.getConfiguredProviderSettings', () => {
  beforeEach(() => {
    process.env = { ...originalEnv, USAGE_LOG_FILE: 'false' };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should fall back to default provider settings when vision uses the same provider', () => {
    process.env.LLM_PROVIDER = 'OpenAI';
    process.env.PROVIDER_BASE_URL = 'https://default-base.example.com';
    process.env.PROVIDER_API_KEY = 'default-key';
    process.env.LLM_VISION_PROVIDER = 'OpenAI';
    process.env.VISION_PROVIDER_BASE_URL = '';
    process.env.VISION_PROVIDER_API_KEY = '';

    const manager = new LLMManager();
    const settings = manager.getConfiguredProviderSettings();

    expect(settings.OpenAI).toEqual({
      enabled: true,
      baseUrl: 'https://default-base.example.com',
      apiKey: 'default-key',
    });
  });

  it('should prefer explicit vision settings over default ones for the same provider', () => {
    process.env.LLM_PROVIDER = 'OpenAI';
    process.env.PROVIDER_BASE_URL = 'https://default-base.example.com';
    process.env.PROVIDER_API_KEY = 'default-key';
    process.env.LLM_VISION_PROVIDER = 'OpenAI';
    process.env.VISION_PROVIDER_BASE_URL = 'https://vision-base.example.com';
    process.env.VISION_PROVIDER_API_KEY = 'vision-key';

    const manager = new LLMManager();
    const settings = manager.getConfiguredProviderSettings();

    expect(settings.OpenAI).toEqual({
      enabled: true,
      baseUrl: 'https://vision-base.example.com',
      apiKey: 'vision-key',
    });
  });
});
