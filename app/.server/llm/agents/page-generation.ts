import { getSystemPrompt } from '~/.server/prompts/prompts';
import type { ElementInfo } from '~/routes/api/chat/chat';
import type { SelectContextResult } from '../select-context';

export const PAGE_GENERATION_STEP_LIMIT = 24;

export type PreparedPageGenerationState = {
  summary: string;
  pageSummaryOutline: string;
  pageSummaryDetailed: string;
  context: Record<string, SelectContextResult>;
  designMd: string;
  visualSummary?: string;
  userPageContext?: string;
  elementInfo?: ElementInfo;
};

export function buildPageGenerationSystemPrompt({
  summary,
  pageSummaryOutline,
  pageSummaryDetailed,
  context,
  designMd,
  visualSummary,
  userPageContext,
  elementInfo,
}: PreparedPageGenerationState) {
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

  if (Object.keys(context).length > 0) {
    systemPrompt = `${systemPrompt}
以下是根据用户的聊天记录和任务分析出的可能对此次任务有帮助的页面及其代码片段，按页面名称区分，多个页面使用 ------ 分割
CONTEXT:
---
${Object.entries(context)
  .map(
    ([, value]) => `
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

  if (visualSummary) {
    systemPrompt = `${systemPrompt}
以下是从用户提供的图片视觉参考中提炼出的摘要。若当前会话还包含原图，则以原图为准；若当前模型无法直接读取原图，则必须以这份视觉摘要作为视觉事实依据：
VISUAL SUMMARY:
---
${visualSummary}
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

  return systemPrompt;
}

export function appendPageSummaryContext(
  systemPrompt: string,
  {
    pageSummaryOutline,
    pageSummaryDetailed,
  }: Pick<PreparedPageGenerationState, 'pageSummaryOutline' | 'pageSummaryDetailed'>,
) {
  let nextPrompt = systemPrompt;

  if (pageSummaryOutline) {
    nextPrompt = `${nextPrompt}
以下是快速页面结构概览：
PAGE SUMMARY OUTLINE:
---
${pageSummaryOutline}
---
    `;
  }

  if (pageSummaryDetailed) {
    nextPrompt = `${nextPrompt}
以下是结合当前任务定位出的重点页面与位置：
PAGE SUMMARY DETAILED:
---
${pageSummaryDetailed}
---
    `;
  }

  return nextPrompt;
}

export function createElementEditPrompt({ tagName, className, id, domId, outerHTML }: ElementInfo): string {
  const elementSelector = [tagName.toLowerCase(), id ? `#${id}` : '', className ? `.${className.split(' ')[0]}` : '']
    .filter(Boolean)
    .join('');
  const effectiveDomId = domId || id;
  const trimmedOuterHTML = outerHTML?.trim();

  return `
<element_edit_context>
  用户当前正在编辑特定元素。请将您的响应限制在此元素的范围内。

  当前编辑的元素: ${elementSelector}
  ${effectiveDomId ? `优先更新目标 domId: ${effectiveDomId}` : '当前元素没有可直接使用的 domId，请选择最小可用祖先节点进行更新。'}

  请严格遵循以下规则：
  1. 仅修改用户当前选中的元素或其子元素
  2. 不要修改页面上的其他元素
  3. 如果是添加操作，仅在当前选中元素内添加内容
  4. 如果是更新操作，优先更新当前选中元素本身，不要把修改范围扩大到整个 section、header、footer 或更大的祖先块
  5. 如果存在可用 domId，优先使用 contentKind=patch；update/remove 的 patch target 必须使用这个 domId
  6. 只有当当前元素没有稳定 domId，或用户明确要求改更大范围布局时，才允许提升到最近的祖先节点
  7. 如果是删除操作，仅删除当前选中元素或其子元素
  8. 保持页面的整体风格和一致性
  9. 只有新增大块结构或无法安全 patch 时，才回退到 contentKind=html
  10. 确保所有生成的 HTML 元素都有唯一的 domId，不要使用相同的 domId

  元素详细信息：
  - 标签名: ${tagName.toLowerCase()}
  ${id ? `- ID: ${id}` : ''}
  ${domId && domId !== id ? `- 最近可用 domId: ${domId}` : ''}
  ${className ? `- 类名: ${className}` : ''}
  ${trimmedOuterHTML ? `- 当前元素 HTML:\n${trimmedOuterHTML}` : ''}
</element_edit_context>
`;
}
