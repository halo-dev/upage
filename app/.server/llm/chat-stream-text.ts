import {
  streamText as _streamText,
  type CallSettings,
  convertToModelMessages,
  type LanguageModel,
  type LanguageModelUsage,
  type StreamTextOnFinishCallback,
  stepCountIs,
  type UIMessageStreamWriter,
} from 'ai';
import { getSystemPrompt } from '~/.server/prompts/prompts';
import { approximatePromptTokenCount, encode } from '~/.server/utils/token';
import type { ElementInfo } from '~/routes/api/chat/chat';
import type { ChatUIMessage } from '~/types/message';
import { appendPageSummaryContext, createElementEditPrompt } from './agents/page-generation';
import { MAX_TOKENS } from './constants';
import type { SelectContextResult } from './select-context';
import { tools } from './tools';

export type ChatStreamTextProps = CallSettings & {
  messages: ChatUIMessage[];
  summary: string;
  pageSummaryOutline: string;
  pageSummaryDetailed: string;
  context?: Record<string, SelectContextResult>;
  model: LanguageModel;
  maxTokens?: number;
  elementInfo?: ElementInfo;
  designMd: string;
  userPageContext?: string;
  writer?: UIMessageStreamWriter<ChatUIMessage>;
  onFinish?: StreamTextOnFinishCallback<any>;
  onAbort?: (params: { event: any; totalUsage: LanguageModelUsage }) => void;
};

export async function chatStreamText({
  messages,
  summary,
  pageSummaryOutline,
  pageSummaryDetailed,
  context,
  model,
  maxTokens,
  elementInfo,
  designMd,
  userPageContext,
  writer,
  abortSignal,
  onFinish,
  onAbort,
}: ChatStreamTextProps) {
  const modelMessages = await convertToModelMessages(messages);
  let systemPrompt = getSystemPrompt();
  systemPrompt = appendPageSummaryContext(systemPrompt, {
    pageSummaryOutline,
    pageSummaryDetailed,
  });

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
以下是根据用户的聊天记录和任务分析出的可能对此次任务有帮助的页面及其代码片段，按页面名称区分，多个页面使用 ------ 分割
CONTEXT:
---
${Object.entries(context)
  .map(
    ([key, value]) => `
  - 页面名称: ${value.pageName}
  - 页面标题: ${value.pageTitle}
  - 页面内容: ${value.sections.join('\n')}
  `,
  )
  .join('------')}
---
    `;
  }

  if (userPageContext) {
    systemPrompt = `${systemPrompt}
以下是用户当前本地尚未保存、但与你这次任务直接相关的页面快照。你必须在理解这些内容后再决定如何修改页面：
LOCAL PAGE SNAPSHOT:
---
${userPageContext}
---
    `;
  }

  systemPrompt = `${systemPrompt}
<design_system>
以下设计系统规范对所有视觉决策具有最高优先级：

- 颜色：必须严格使用 colors 中定义的色值，禁止自行引入其他颜色
- 字体：必须遵循 typography 中定义的字族、字号、字重和行高
- 圆角：使用 rounded 中定义的圆角值，保持一致的形状语言
- 间距：使用 spacing 中定义的间距标尺
- 组件：遵循 components 中定义的按钮、输入框等组件样式

${designMd}
</design_system>
  `;

  if (elementInfo) {
    systemPrompt = `${systemPrompt}
    ${createElementEditPrompt(elementInfo)}
    `;
  }

  return _streamText({
    model,
    tools: tools({
      onPage: (page) => {
        writer?.write({
          type: 'data-upage-page',
          data: page,
        });
      },
    }),
    system: systemPrompt,
    maxOutputTokens: maxTokens || MAX_TOKENS,
    messages: modelMessages,
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
          inputTokenDetails: {
            noCacheTokens: inoutTokens,
            cacheReadTokens: 0,
            cacheWriteTokens: 0,
          },
          outputTokens: 0,
          outputTokenDetails: {
            textTokens: 0,
            reasoningTokens: 0,
          },
          totalTokens: inoutTokens,
          reasoningTokens: 0,
          cachedInputTokens: 0,
        },
      });
    },
  });
}
