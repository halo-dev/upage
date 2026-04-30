import type { Tool, ToolSet } from 'ai';
import type { UPagePagePart } from '~/types/message';
import { serperTool } from './serper';
import { createUPageTool } from './upage';
import { weatherTool } from './weather';

export const tools = ({ onPage }: { onPage?: (page: UPagePagePart) => void } = {}): ToolSet => {
  const tools: Record<string, Tool> = {};

  if (onPage) {
    tools.upage = createUPageTool(onPage);
  }

  if (process.env.SERPER_API_KEY) {
    tools.serper = serperTool;
  }

  if (process.env.WEATHER_API_KEY) {
    tools.weather = weatherTool;
  }

  return tools;
};
