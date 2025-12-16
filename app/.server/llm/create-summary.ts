import { type CallSettings, generateText, type LanguageModel } from 'ai';
import { createScopedLogger } from '~/.server/utils/logger';
import type { UPageUIMessage } from '~/types/message';
import { extractCurrentContext, getUserMessageContent, simplifyUPageActions } from './utils';

const logger = createScopedLogger('create-summary');

export async function createSummary({
  messages,
  model,
  abortSignal,
}: {
  messages: UPageUIMessage[];
  model: LanguageModel;
} & CallSettings) {
  const processedMessages = messages.map((message) => {
    if (message.role === 'user') {
      const content = getUserMessageContent(message);

      return { ...message, content };
    }

    if (message.role == 'assistant') {
      for (const part of message.parts) {
        if (part.type === 'text') {
          part.text = simplifyUPageActions(part.text);
          part.text = part.text.replace(/<div class=\\"__uPageThought__\\">.*?<\/div>/s, '');
        }
        if (part.type === 'reasoning') {
          part.text = part.text.replace(/<think>.*?<\/think>/s, '');
        }
      }

      return message;
    }

    return message;
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

  const extractTextContent = (message: UPageUIMessage) =>
    message.parts
      .map((part) => {
        if (part.type === 'text') {
          return part.text;
        }
        return '';
      })
      .join('\n');

  return await generateText({
    system: `
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
        `,
    prompt: `

以下是之前的聊天摘要：
<old_summary>
${summaryText}
</old_summary>

以下是之后的聊天记录：
---
<new_chats>
${slicedMessages
  .map((x) => {
    return `---\n[${x.role}] ${extractTextContent(x)}\n---`;
  })
  .join('\n')}
</new_chats>
---

请提供截至目前聊天的摘要，包括聊天的历史记录摘要。
`,
    model,
    abortSignal,
  });
}
