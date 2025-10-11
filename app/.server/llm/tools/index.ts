import type { Tool, ToolSet } from 'ai';
import { serperTool } from './serper';
import { weatherTool } from './weather';

export const tools: () => ToolSet = () => {
  const tools: Record<string, Tool> = {};

  if (process.env.SERPER_API_KEY) {
    tools.serper = serperTool;
  }

  if (process.env.WEATHER_API_KEY) {
    tools.weather = weatherTool;
  }

  return tools;
};
