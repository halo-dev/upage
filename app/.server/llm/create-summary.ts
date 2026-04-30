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
import { consumeStreamTextFullStream, type StreamTextUIEvent } from './ui-message-stream';
import {
  extractCurrentContext,
  extractMessageTextForPrompt,
  getUserMessageContent,
  simplifyUPageActions,
} from './utils';

const logger = createScopedLogger('create-summary');

export async function createSummary({
  messages,
  visualSummary,
  model,
  abortSignal,
  onStreamEvent,
  onAbortUsage,
}: {
  messages: ChatUIMessage[];
  visualSummary?: string;
  model: LanguageModel;
  onStreamEvent?: (event: StreamTextUIEvent) => void;
  onAbortUsage?: (usage: TokenUsageSnapshot) => void;
} & CallSettings) {
  const processedMessages = messages.map((message) => {
    const nextMessage: ChatUIMessage = {
      ...message,
      parts: [...(message.parts || [])],
    };

    if (message.role === 'user') {
      const content = getUserMessageContent(message, {
        includeVisualHint: true,
        visualSummary: message === messages[messages.length - 1] ? visualSummary : undefined,
      });

      return { ...nextMessage, content };
    }

    if (message.role == 'assistant') {
      for (const part of nextMessage.parts || []) {
        if (part.type === 'text') {
          part.text = simplifyUPageActions(part.text);
          part.text = part.text.replace(/<div class=\\"__uPageThought__\\">.*?<\/div>/s, '');
        }
        if (part.type === 'reasoning') {
          part.text = part.text.replace(/<think>.*?<\/think>/s, '');
        }
      }

      return nextMessage;
    }

    return nextMessage;
  });

  let slicedMessages = processedMessages;
  const { summary } = extractCurrentContext(processedMessages);
  let summaryText: string | undefined = undefined;
  let chatId: string | undefined = undefined;

  if (summary) {
    chatId = summary.chatId;
    summaryText = `以下是截至目前为止的聊天摘要，将其作为历史消息参考使用。
${summary.summary}`;

    if (chatId) {
      let index = 0;

      for (let i = 0; i < processedMessages.length; i++) {
        if (processedMessages[i].id === chatId) {
          index = i;
          break;
        }
      }
      slicedMessages = processedMessages.slice(index + 1);
    }
  }

  logger.debug('切片消息长度:', slicedMessages.length);

  const system = `
        你是一名软件工程师。你正在参与一个项目。你需要总结目前的工作内容，并提供截至目前对话的摘要。

        请仅使用以下格式生成摘要：
---
# 项目概览
- **项目名称**: {project_name} - {brief_description}
- **当前阶段**: {phase}

# 对话上下文
- **最近讨论点**: {main_discussion_point}
- **重要决策**: {important_decisions_made}

# 实现状态
## 当前状态
- **活跃功能**: {feature_in_development}
- **进展**: {what_works_and_what_doesn't}
- **障碍**: {current_challenges}

## 代码演化
- **最近修改**: {latest_modifications}

# 需求
- **已实现**: {completed_features}
- **进行中**: {current_focus}
- **待定**: {upcoming_features}

# 关键记忆
- **必须保留**: {crucial_technical_context}
- **用户需求**: {specific_user_needs}
- **已知问题**: {documented_problems}

# 下一步行动
- **立即行动**: {next_steps}
- **待解决的问题**: {unresolved_issues}

---
Note:
4. 保持条目简洁，重点记录确保工作连续性所需的信息。


---

        RULES:
        * 仅提供截至目前为止的聊天摘要。
        * 不要提供任何新信息。
        * 不需要过多思考，立即开始写作
        * 不要写任何与提供的结构不同的摘要
        `;
  const prompt = `

以下是之前的聊天摘要：
<old_summary>
${summaryText}
</old_summary>

以下是之后的聊天记录：
---
<new_chats>
${slicedMessages
  .map((x) => {
    return `---\n[${x.role}] ${extractMessageTextForPrompt(x)}\n---`;
  })
  .join('\n')}
</new_chats>
---

请提供截至目前聊天的摘要，包括聊天的历史记录摘要。
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

    return {
      text,
      totalUsage,
      content,
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
