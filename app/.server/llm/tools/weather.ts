/**
 * 由于 agentic 暂时不支持 AI SDK v5，因此使用自定义的 Weather 工具。
 * @see https://docs.agentic.so/marketplace/ts-sdks/ai-sdk
 */
import { tool } from 'ai';
import { z } from 'zod';

const API_BASE_URL = 'https://api.weatherapi.com/v1';

const weatherParamsSchema = z.object({
  q: z
    .string()
    .describe('位置查询，可以是城市名称、邮政编码、IP地址或经纬度坐标。必须使用英语或拼音。例如："London"、"Beijing"'),
});

export const weatherTool = tool({
  description: '获取指定位置的天气信息',
  inputSchema: weatherParamsSchema,
  execute: async ({ q }) => {
    const apiKey = process.env.WEATHER_API_KEY || '';
    if (!apiKey) {
      throw new Error('Missing WEATHER_API_KEY');
    }

    try {
      const url = new URL(`${API_BASE_URL}/current.json`);
      url.searchParams.append('key', apiKey);
      url.searchParams.append('q', q);

      const response = await fetch(url.toString());

      if (!response.ok) {
        throw new Error(`Weather API responded with status: ${response.status}`);
      }

      return await response.json();
    } catch (error: unknown) {
      console.error('Weather API error:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      throw new Error(`获取天气信息失败: ${errorMessage}`);
    }
  },
});
