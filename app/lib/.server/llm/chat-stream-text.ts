import {
  streamText as _streamText,
  type CallSettings,
  convertToModelMessages,
  type LanguageModel,
  type LanguageModelUsage,
  type StreamTextOnFinishCallback,
  stepCountIs,
} from 'ai';
import { getSystemPrompt } from '~/lib/common/prompts/prompts';
import type { ElementInfo } from '~/routes/api.chat/chat.server';
import type { UPageUIMessage } from '~/types/message';
import { approximatePromptTokenCount, encode } from '~/utils/token';
import { MAX_TOKENS } from './constants';
import { tools } from './tools';

export type ChatStreamTextProps = CallSettings & {
  messages: UPageUIMessage[];
  summary: string;
  pageSummary: string;
  context?: Record<string, string[]>;
  model: LanguageModel;
  maxTokens?: number;
  elementInfo?: ElementInfo;
  onFinish?: StreamTextOnFinishCallback<any>;
  onAbort?: (params: { event: any; totalUsage: LanguageModelUsage }) => void;
};

export async function chatStreamText({
  messages,
  summary,
  pageSummary,
  context,
  model,
  maxTokens,
  elementInfo,
  abortSignal,
  onFinish,
  onAbort,
}: ChatStreamTextProps) {
  let systemPrompt = getSystemPrompt();

  if (pageSummary) {
    systemPrompt = `${systemPrompt}
以下是截止目前为止的页面摘要：
PAGE SUMMARY:
---
${pageSummary}
---
    `;
  }

  if (summary) {
    systemPrompt = `${systemPrompt}
以下是截至目前为止的聊天记录摘要：
CHAT SUMMARY:
---
${summary}
---
    `;
  }

  if (context) {
    systemPrompt = `${systemPrompt}
以下是根据用户的聊天记录和任务分析出的可能对此次任务有帮助的代码片段，按页面名称区分
CONTEXT:
---
${Object.entries(context)
  .map(([key, value]) => `${key}: ${value.join('\n')}\n`)
  .join('\n')}
---
    `;
  }

  if (elementInfo) {
    systemPrompt = `${systemPrompt}
    ${createElementEditPrompt(elementInfo)}
    `;
  }

  return _streamText({
    model,
    tools,
    system: systemPrompt,
    maxOutputTokens: maxTokens || MAX_TOKENS,
    messages: convertToModelMessages(messages),
    stopWhen: stepCountIs(3),
    prepareStep: async ({ messages }) => {
      if (messages.length > 20) {
        return {
          messages: messages.slice(-10),
        };
      }
      return {};
    },
    abortSignal,
    onFinish,
    onAbort(event) {
      // 由于 AI SDK 没有提供在 onAbort 中计算 Token 消耗的方法。所以这里手动计算。
      let inoutTokens = 0;
      inoutTokens += approximatePromptTokenCount(messages);
      inoutTokens += encode(systemPrompt).length;
      onAbort?.({
        event,
        totalUsage: {
          inputTokens: inoutTokens,
          outputTokens: 0,
          totalTokens: inoutTokens,
          reasoningTokens: 0,
          cachedInputTokens: 0,
        },
      });
    },
  });
}

/**
 * 根据元素编辑信息创建相应的系统提示
 * @param elementEdit 元素编辑信息
 * @returns 系统提示字符串
 */
function createElementEditPrompt({ tagName, className, id }: ElementInfo): string {
  // 构建元素选择器描述
  const elementSelector = [tagName.toLowerCase(), id ? `#${id}` : '', className ? `.${className.split(' ')[0]}` : '']
    .filter(Boolean)
    .join('');

  return `
<element_edit_context>
  用户当前正在编辑特定元素。请将您的响应限制在此元素的范围内。

  当前编辑的元素: ${elementSelector}

  请严格遵循以下规则：
  1. 仅修改用户当前选中的元素或其子元素
  2. 不要修改页面上的其他元素
  3. 如果是添加操作，仅在当前选中元素内添加内容
  4. 如果是更新操作，确保使用最小化更新，并保留元素的 domId
  5. 如果是删除操作，仅删除当前选中元素或其子元素
  6. 保持页面的整体风格和一致性
  7. 确保所有生成的 HTML 元素都有唯一的 domId，不要使用相同的 domId

  元素详细信息：
  - 标签名: ${tagName.toLowerCase()}
  ${id ? `- ID: ${id}` : ''}
  ${className ? `- 类名: ${className}` : ''}
</element_edit_context>
`;
}
