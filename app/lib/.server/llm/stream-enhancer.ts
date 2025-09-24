import { convertToModelMessages, type LanguageModel, streamText, type UIMessage } from 'ai';
import { createScopedLogger } from '~/lib/.server/logger';
import { DEFAULT_PROVIDER } from '~/utils/constants';
import { stripIndents } from '~/utils/strip-indent';

const logger = createScopedLogger('stream-enhancer');

export async function streamEnhancer(props: { messages: UIMessage[]; model: LanguageModel; maxTokens?: number }) {
  const { messages, model, maxTokens } = props;

  logger.info(`发送 llm 调用至 ${DEFAULT_PROVIDER.name} 使用模型 ${model}`);

  const systemMessage = stripIndents`
  你是一位专业提示工程师，专注于制作精确、有效的提示。
  你的任务是增强提示，使其更加具体、可操作且有效。

  对于有效的提示：
  - 使指令明确且无歧义
  - 添加相关上下文和约束
  - 删除冗余信息
  - 保持核心意图
  - 确保提示自包含
  - 使用专业语言

  对于无效或不明确的提示：
  - 提供清晰、专业的指导
  - 保持响应简洁且可操作
  - 保持有帮助、建设性的语气
  - 专注于用户应该提供的内容
  - 使用标准模板保持一致

  <output_format>
  1. 响应必须仅包含增强后的提示文本。
  2. 不要包含任何解释、元数据或包装标签。
  </output_format>
`;

  const result = streamText({
    model,
    system: systemMessage,
    maxOutputTokens: maxTokens,
    messages: convertToModelMessages(messages),
  });
  return result.toUIMessageStreamResponse();
}
