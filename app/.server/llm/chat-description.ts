import { type LanguageModel, type LanguageModelUsage, streamText } from 'ai';
import type { ChatUIMessage } from '~/types/message';
import { createAbortError, isAbortError, throwIfAborted } from './abort';
import { getUserMessageContent } from './utils';

const MAX_CHAT_DESCRIPTION_LENGTH = 30;

export async function generateChatDescription({
  message,
  model,
  abortSignal,
}: {
  message: Omit<ChatUIMessage, 'id'>;
  model: LanguageModel;
  abortSignal?: AbortSignal;
}): Promise<{
  description: string;
  totalUsage: LanguageModelUsage;
}> {
  throwIfAborted(abortSignal);

  const prompt = getUserMessageContent(message, { includeVisualHint: true });
  const result = streamText({
    model,
    abortSignal,
    system: `你是一名聊天标题助手。你的任务是根据用户刚刚输入的网页生成需求，总结出一个简短、自然、适合展示在聊天列表里的标题。

要求：
1. 标题默认跟随用户输入语言。
2. 只输出标题本身，不要解释，不要加引号，不要加序号，不要换行。
3. 尽量控制在 6 到 18 个字或等价长度内，绝对不要超过 30 个字符。
4. 优先保留页面类型、主题对象、核心场景等高信息密度内容。
5. 如果用户输入非常短，直接提炼为可读标题。
6. 不要输出“未命名聊天”之类的占位词。
7. 不要使用思考，不要输出思考过程，直接给出最终标题。`,
    prompt,
  });

  try {
    const text = await result.text;
    return {
      description: normalizeChatDescriptionOutput(text),
      totalUsage: await result.totalUsage,
    };
  } catch (error) {
    if (isAbortError(error, abortSignal)) {
      throw createAbortError();
    }

    throw error;
  }
}

function normalizeChatDescriptionOutput(value: string) {
  const firstLine = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  let normalized = (firstLine || value).trim();

  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'")) ||
    (normalized.startsWith('“') && normalized.endsWith('”')) ||
    (normalized.startsWith('‘') && normalized.endsWith('’'))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }

  const characters = Array.from(normalized);
  if (characters.length > MAX_CHAT_DESCRIPTION_LENGTH) {
    normalized = characters.slice(0, MAX_CHAT_DESCRIPTION_LENGTH).join('').trim();
  }

  return normalized;
}
