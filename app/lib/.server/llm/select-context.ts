import { type CallSettings, generateText, type LanguageModel } from 'ai';
import { createScopedLogger } from '~/lib/.server/logger';

import type { Page } from '~/types/actions';
import type { UPageUIMessage } from '~/types/message';

const logger = createScopedLogger('select-context');

export async function selectContext({
  messages,
  pages,
  summary,
  model,
  abortSignal,
}: {
  messages: UPageUIMessage[];
  pages: Page[];
  summary: string;
  model: LanguageModel;
} & CallSettings) {
  const extractTextContent = (message: UPageUIMessage) =>
    message.parts.find((part) => part.type === 'text')?.text || '';

  const lastUserMessage = messages.filter((x) => x.role == 'user').pop();
  if (!lastUserMessage) {
    throw new Error('未找到用户消息');
  }

  const pagesContent = pages.map((page) => {
    return `
    ---
    页面名称：${page.name}
    ---
    页面内容：${page.content}
    `;
  });

  const resp = await generateText({
    system: `
        你是一名软件工程师。你正在从事一个 HTML 项目，该项目包含多个页面，每个页面内容中包含多个 Section。这些 Section 可能是 HTML、style、JavaScript 片段。
        提供给你的为 Body 内容，每个处于根节点下的 HTML 标签，都包含一个唯一的 domId 属性，并且为单独的一个 Section。

        ${pagesContent.join('\n')}

        ---

        现在，你将获得一个任务。你需要从上述页面列表中选择与任务相关的页面与其相关的 Section。

        RESPONSE FORMAT:
        你的回复应严格遵循以下格式:
---
  <updateContextBuffer>
      <selectPage pageName="pageName">
        <selectSection>
        ...section content...
        </selectSection>
        ...
      </selectPage>
      ...
  </updateContextBuffer>
---
        * 你应该从 <updateContextBuffer> 开始，以 </updateContextBuffer> 结束。
        * 你可以在回复中包含多个 <selectPage> 标签，每个 <selectPage> 标签中也可以包含多个 <selectSection> 标签。
        * 你需要在 <selectPage> 标签中包含页面名称，但每个页面名称只能出现一次。
        * 你需要在 <selectSection> 标签中包含完整的 Section 内容，只做选择，但不要对 Section 内容进行任何修改。
        * 如果不需要任何更改，你可以留下空的 updateContextBuffer 标签。
        `,
    prompt: `
        以下是截至目前聊天的摘要： ${summary}

        用户当前任务: ${extractTextContent(lastUserMessage)}

        请根据当前页面与 Section 的详细代码，选择与任务相关的页面以及 Section。
        `,
    model,
    abortSignal,
  });

  const response = resp.text;
  const updateContextBuffer = response.match(/<updateContextBuffer>([\s\S]*?)<\/updateContextBuffer>/);

  if (!updateContextBuffer) {
    throw new Error('无效响应。请遵循响应格式');
  }

  const updateContextBufferContent = updateContextBuffer[1];
  const selectedPages: Record<string, string[]> = {};

  const selectPageRegex = /<selectPage\s+pageName="([^"]+)">([\s\S]*?)<\/selectPage>/g;
  let selectPageMatch;

  while ((selectPageMatch = selectPageRegex.exec(updateContextBufferContent)) !== null) {
    const pageName = selectPageMatch[1];
    const pageContent = selectPageMatch[2];

    if (!pageName) {
      logger.warn('页面名称为空');
      continue;
    }

    const selectSectionRegex = /<selectSection>([\s\S]*?)<\/selectSection>/g;
    const sections: string[] = [];
    let selectSectionMatch;

    while ((selectSectionMatch = selectSectionRegex.exec(pageContent)) !== null) {
      const sectionContent = selectSectionMatch[1];
      if (sectionContent.trim()) {
        sections.push(sectionContent.trim());
      }
    }

    if (sections.length > 0) {
      selectedPages[pageName] = sections;
    }
  }

  const { text, content, totalUsage } = resp;
  return {
    text,
    content,
    totalUsage,
    context: selectedPages,
  };
}
