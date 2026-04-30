import { convertToModelMessages, type LanguageModel, type LanguageModelUsage, streamText } from 'ai';
import type { ChatUIMessage } from '~/types/message';
import { createAbortError, isAbortError, throwIfAborted } from './abort';
import { consumeStreamTextFullStream } from './ui-message-stream';
import { createVisionAnalysisMessage } from './utils';

export async function summarizeVisualReference({
  message,
  model,
  abortSignal,
}: {
  message: Omit<ChatUIMessage, 'id'>;
  model: LanguageModel;
  abortSignal?: AbortSignal;
}): Promise<{
  summary: string;
  totalUsage: LanguageModelUsage;
}> {
  throwIfAborted(abortSignal);

  const modelMessages = await convertToModelMessages([
    createVisionAnalysisMessage(
      message,
      '请读取上述图片与文本，只输出一份简洁但高信息密度的视觉摘要。必须覆盖：页面类型、整体风格、配色倾向、排版层级、圆角/留白/密度、关键布局结构、显著组件特征、任何重要文字信息。不要编造用户未提供的内容。',
    ),
  ]);

  const result = streamText({
    model,
    abortSignal,
    system:
      '你是一名视觉分析助手。你要把网站参考图提炼成供后续页面生成使用的视觉摘要。摘要要忠于图片事实，避免夸张和脑补。',
    messages: modelMessages,
  });

  try {
    const summary = await consumeStreamTextFullStream({
      fullStream: result.fullStream,
      abortSignal,
    });

    return {
      summary: summary.trim(),
      totalUsage: await result.totalUsage,
    };
  } catch (error) {
    if (isAbortError(error, abortSignal)) {
      throw createAbortError();
    }

    throw error;
  }
}
