import { type CallSettings, type LanguageModel, streamText } from 'ai';
import {
  accumulateUsageSnapshot,
  createEmptyTokenUsage,
  estimateTextStreamAbortUsage,
  type TokenUsageSnapshot,
} from '~/.server/utils/token';
import type { PageData } from '~/types/pages';
import { createAbortError, isAbortError } from './abort';
import { buildSnapshotDetailedContent, buildSnapshotOutlineContent } from './preparation';
import { consumeStreamTextFullStream, type StreamTextUIEvent } from './ui-message-stream';

export type StructuredPageSnapshotMode = 'outline' | 'detailed';

export async function structuredPageSnapshot({
  pages,
  model,
  mode = 'detailed',
  userTask,
  abortSignal,
  onStreamEvent,
  onAbortUsage,
}: {
  pages: PageData[];
  model: LanguageModel;
  mode?: StructuredPageSnapshotMode;
  userTask?: string;
  onStreamEvent?: (event: StreamTextUIEvent) => void;
  onAbortUsage?: (usage: TokenUsageSnapshot) => void;
} & CallSettings) {
  const pagePrompt = pages
    .map((page) => {
      const pageContent = mode === 'outline' ? buildSnapshotOutlineContent(page) : buildSnapshotDetailedContent(page);
      return `<page_name>${page.name}</page_name><page_title>${page.title}</page_title><page_content>${pageContent}</page_content>`;
    })
    .join('\n --- \n');

  const system =
    mode === 'outline'
      ? `
你是一名高效的页面结构分析助手。你将收到多个页面的轻量结构信息，而不是完整 HTML。
你的目标是快速理解每个页面的大致布局、主要内容、互动元素，以及哪些位置后续可能值得深入分析。

输出必须严格遵循以下 XML 模板：
<snapshot_outline>
  <pages_count></pages_count>
  <pages>
    <page>
      <name></name>
      <title></title>
      <purpose></purpose>
      <main_blocks></main_blocks>
      <key_content></key_content>
      <interactive_elements></interactive_elements>
      <potential_targets></potential_targets>
    </page>
  </pages>
</snapshot_outline>

严格输出规则：
- 仅输出上述 XML，不要输出任何解释性文字、代码块符号或 Markdown；
- 标签名、层级和顺序必须保持一致；
- 所有可读文本内容应尽量跟随页面内容的主要语言；若无法判断，则使用与输入内容最接近的自然语言；
- 只做快速概览，不要臆测未出现的信息。`
      : `
你是一名页面编辑定位助手。你将收到与当前任务相关的页面内容片段。
你的目标是结合用户任务，快速定位最可能需要修改的位置、相关区块以及判断依据。

输出必须严格遵循以下 XML 模板：
<snapshot_detailed>
  <task_summary></task_summary>
  <likely_pages></likely_pages>
  <pages>
    <page>
      <name></name>
      <title></title>
      <focus></focus>
      <relevant_sections></relevant_sections>
      <edit_hints></edit_hints>
      <evidence></evidence>
    </page>
  </pages>
</snapshot_detailed>

严格输出规则：
- 仅输出上述 XML，不要输出任何解释性文字、代码块符号或 Markdown；
- 标签名、层级和顺序必须保持一致；
- 所有可读文本内容应尽量跟随页面内容的主要语言；若无法判断，则使用与输入内容最接近的自然语言；
- 重点分析与当前任务直接相关的位置，不要泛泛复述全部内容；
- 不得包含未在输入中出现的臆测信息。`;

  const prompt =
    mode === 'outline'
      ? `
以下是页面的轻量结构信息：
---
<pages>
${pagePrompt}
</pages>
---
`
      : `
当前任务：
---
${userTask || '未提供明确任务，请根据页面内容提炼最可能需要深入分析的位置。'}
---

以下是页面的相关内容片段：
---
<pages>
${pagePrompt}
</pages>
---
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
