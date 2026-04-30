import { serperTool } from '../tools/serper';
import { weatherTool } from '../tools/weather';

export function createOptionalPageBuilderTools() {
  return {
    ...(process.env.SERPER_API_KEY ? { serper: serperTool } : {}),
    ...(process.env.WEATHER_API_KEY ? { weather: weatherTool } : {}),
  };
}
