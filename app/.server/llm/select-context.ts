import { type CallSettings, type LanguageModel, streamText } from 'ai';
import { createScopedLogger } from '~/.server/utils/logger';
import {
  accumulateUsageSnapshot,
  createEmptyTokenUsage,
  estimateTextStreamAbortUsage,
  type TokenUsageSnapshot,
} from '~/.server/utils/token';
import type { ChatUIMessage } from '~/types/message';
import { createAbortError, isAbortError } from './abort';
import type { PageSelectionCandidate } from './preparation';
import { consumeStreamTextFullStream, type StreamTextUIEvent } from './ui-message-stream';
import { getUserMessageContent } from './utils';

const logger = createScopedLogger('select-context');

export type SelectContextResult = {
  sections: string[];
  pageName: string;
  pageTitle: string;
};

export async function selectContext({
  messages,
  pages,
  summary,
  visualSummary,
  model,
  abortSignal,
  onStreamEvent,
  onAbortUsage,
}: {
  messages: ChatUIMessage[];
  pages: PageSelectionCandidate[];
  summary: string;
  visualSummary?: string;
  model: LanguageModel;
  onStreamEvent?: (event: StreamTextUIEvent) => void;
  onAbortUsage?: (usage: TokenUsageSnapshot) => void;
} & CallSettings) {
  const lastUserMessage = messages.filter((x) => x.role == 'user').pop();
  if (!lastUserMessage) {
    throw new Error('未找到用户消息');
  }

  const pagesContent = pages.map((page) => {
    return `
---
页面名称：${page.name}
页面标题：${page.title}
页面长度：${page.contentLength}
操作数量：${page.actionCount}
页面摘要：${page.preview}
---`;
  });

  const system = `
        你是一名软件工程师。你正在从事一个 HTML 项目。你会收到多个页面的轻量索引，而不是完整 HTML。

        ${pagesContent.join('\n')}

        ---

        现在，你将获得一个任务。你需要从上述页面列表中选择与任务最相关的页面名称。请务必保证：
        - 最多选择 3 个页面。
        - 优先选择最可能被修改、最可能承载相关结构或脚本的页面。
        - 如果无法明确判断，可以返回空结果。

        RESPONSE FORMAT:
        你的回复应严格遵循以下格式:
---
  <updateContextBuffer>
      <selectPage pageName="pageName" pageTitle="pageTitle">
        <selectReason>
        ...why this page matters...
        </selectReason>
      </selectPage>
      ...
  </updateContextBuffer>
---
        * 你应该从 <updateContextBuffer> 开始，以 </updateContextBuffer> 结束。
        * 你可以在回复中包含多个 <selectPage> 标签。
        * 你需要在 <selectPage> 标签中包含页面名称和页面标题，但每个页面只能出现一次。
        * 如果不需要任何更改，你可以留下空的 updateContextBuffer 标签。
        `;
  const prompt = `
        以下是截至目前聊天的摘要： ${summary}

        用户当前任务: ${getUserMessageContent(lastUserMessage, {
          includeVisualHint: true,
          visualSummary,
        })}

        请根据当前页面索引，选择与任务相关的页面。
        `;
  const completedUsage = createEmptyTokenUsage();
  let stepCompleted = false;
  let streamedText = '';

  const result = streamText({
    system,
    prompt,
    model,
    abortSignal,
    onStepFinish: ({ usage }) => {
      stepCompleted = true;
      accumulateUsageSnapshot(completedUsage, usage);
    },
  });

  try {
    const text = await consumeStreamTextFullStream({
      fullStream: result.fullStream,
      abortSignal,
      onEvent: (event) => {
        streamedText = event.text;
        onStreamEvent?.(event);
      },
    });

    const totalUsage = await result.totalUsage;
    const content = await result.content;

    const response = text;
    const updateContextBuffer = response.match(/<updateContextBuffer>([\s\S]*?)<\/updateContextBuffer>/);

    if (!updateContextBuffer) {
      throw new Error('无效响应。请遵循响应格式');
    }

    const updateContextBufferContent = updateContextBuffer[1];
    const selectedPages: Record<string, SelectContextResult> = {};

    const selectPageRegex = /<selectPage\s+pageName="([^"]+)"\s+pageTitle="([^"]+)">([\s\S]*?)<\/selectPage>/g;
    let selectPageMatch;

    while ((selectPageMatch = selectPageRegex.exec(updateContextBufferContent)) !== null) {
      const pageName = selectPageMatch[1];
      const pageTitle = selectPageMatch[2];
      const pageContent = selectPageMatch[3];

      if (!pageName) {
        logger.warn('页面名称为空');
        continue;
      }

      const reasonMatch = pageContent.match(/<selectReason>([\s\S]*?)<\/selectReason>/);
      const reason = reasonMatch?.[1]?.trim();
      selectedPages[pageName] = {
        sections: reason ? [reason] : [],
        pageName,
        pageTitle,
      };
    }

    return {
      text,
      content,
      totalUsage,
      context: selectedPages,
    };
  } catch (error) {
    if (isAbortError(error, abortSignal)) {
      if (!stepCompleted) {
        const abortedUsage = estimateTextStreamAbortUsage({
          system,
          prompt,
          streamedText,
        });
        onAbortUsage?.(abortedUsage);
      } else {
        onAbortUsage?.(completedUsage);
      }
      throw createAbortError();
    }

    throw error;
  }
}
