import { type CallSettings, generateText, type LanguageModel } from 'ai';
import { createScopedLogger } from '~/.server/utils/logger';
import type { UPageUIMessage } from '~/types/message';
import type { PageData } from '~/types/pages';

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
  model,
  abortSignal,
}: {
  messages: UPageUIMessage[];
  pages: PageData[];
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
    页面标题：${page.title}
    ---
    页面内容：${page.content}
    `;
  });

  const resp = await generateText({
    system: `
        你是一名软件工程师。你正在从事一个 HTML 项目，该项目包含多个页面，每个页面内容中包含 HTML 片段，可能是 HTML、style、JavaScript 片段。

        ${pagesContent.join('\n')}

        ---

        现在，你将获得一个任务。你需要从上述页面列表中选择与任务相关的页面与用户任务相关的 HTML 片段。请务必保证：
        - 如果涉及到脚本，则需要选择可能相关的所有脚本的完整内容。
        - 如果涉及到样式，则需要选择可能相关的所有样式，包括内联样式、外部样式表和 style 标签中的样式。

        RESPONSE FORMAT:
        你的回复应严格遵循以下格式:
---
  <updateContextBuffer>
      <selectPage pageName="pageName" pageTitle="pageTitle">
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
        * 你需要在 <selectPage> 标签中包含页面名称和页面标题，但每个页面只能出现一次。
        * 你需要在 <selectSection> 标签中包含完整的 HTML 内容，只做选择，但不要对 HTML 内容进行任何修改。
        * 如果不需要任何更改，你可以留下空的 updateContextBuffer 标签。
        `,
    prompt: `
        以下是截至目前聊天的摘要： ${summary}

        用户当前任务: ${extractTextContent(lastUserMessage)}

        请根据当前页面、页面属性以及内容，选择与任务相关的页面以及 HTML 片段。
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
      selectedPages[pageName] = {
        sections,
        pageName,
        pageTitle,
      };
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
