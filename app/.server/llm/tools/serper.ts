/**
 * 由于 agentic 暂时不支持 AI SDK v5，因此使用自定义的 Serper 工具。
 * @see https://docs.agentic.so/marketplace/ts-sdks/ai-sdk
 */
import { tool } from 'ai';
import { z } from 'zod';

const API_BASE_URL = 'https://google.serper.dev';

const searchParamsSchema = z.object({
  q: z.string().describe('搜索查询词'),
  autocorrect: z.boolean().optional().default(true).describe('是否自动纠正拼写错误'),
  gl: z.string().optional().default('us').describe('地理位置代码，如"us"表示美国'),
  hl: z.string().optional().default('en').describe('语言代码，如"en"表示英语'),
  page: z.number().optional().default(1).describe('页码'),
  num: z.number().optional().default(10).describe('结果数量'),
  type: z
    .enum(['search', 'images', 'videos', 'places', 'news', 'shopping'])
    .optional()
    .default('search')
    .describe('搜索类型'),
});

export const serperTool = tool({
  description: '使用Google搜索获取最新信息。适用于查找新闻、事实、数据和当前事件等实时信息。',
  inputSchema: searchParamsSchema,
  execute: async ({ q, ...params }) => {
    const apiKey = process.env.SERPER_API_KEY || '';
    if (!apiKey) {
      throw new Error('Missing SERPER_API_KEY');
    }

    try {
      const response = await fetch(`${API_BASE_URL}/search`, {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q, ...params }),
      });

      if (!response.ok) {
        throw new Error(`Serper API responded with status: ${response.status}`);
      }

      return await response.json();
    } catch (error: unknown) {
      console.error('Serper API error:', error);
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      throw new Error(`搜索失败: ${errorMessage}`);
    }
  },
});
