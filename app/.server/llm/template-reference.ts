import { type LanguageModel, type LanguageModelUsage, streamText } from 'ai';
import { JSDOM } from 'jsdom';
import {
  accumulateUsageSnapshot,
  createEmptyTokenUsage,
  estimateTextStreamAbortUsage,
  type TokenUsageSnapshot,
} from '~/.server/utils/token';
import { createAbortError, isAbortError } from './abort';
import { consumeStreamTextFullStream, type StreamTextUIEvent } from './ui-message-stream';

type TemplatePageInput = {
  name: string;
  title: string;
  content: string;
};

type TemplateSectionInput = {
  type: string;
  pageName: string;
  content: string;
};

type TemplateReferenceBuilderInput = {
  templateName: string;
  templateDescription?: string | null;
  templatePreviewUrl?: string | null;
  pages: TemplatePageInput[];
  sections: TemplateSectionInput[];
  model: LanguageModel;
  abortSignal?: AbortSignal;
  onAbortUsage?: (usage: TokenUsageSnapshot) => void;
  onStreamEvent?: (event: StreamTextUIEvent) => void;
};

export type ResolvedTemplateReferenceContext = {
  analysis: string;
  htmlSnippets?: string;
  totalUsage?: LanguageModelUsage;
};

type HtmlSnippetCandidate = {
  id: string;
  pageName: string;
  html: string;
  metrics: ElementStructureMetrics;
  preview: string;
};

type ElementStructureMetrics = {
  textLength: number;
  headingCount: number;
  hasH1: boolean;
  buttonLikeCount: number;
  navCount: number;
  listGroupCount: number;
  listItemCount: number;
  articleCount: number;
  quoteCount: number;
  detailsCount: number;
  formControlCount: number;
  mediaCount: number;
  directChildCount: number;
  repeatableCardCount: number;
};

export async function buildTemplateReferenceContext({
  templateName,
  templateDescription,
  templatePreviewUrl,
  pages,
  sections,
  model,
  abortSignal,
  onAbortUsage,
  onStreamEvent,
}: TemplateReferenceBuilderInput): Promise<ResolvedTemplateReferenceContext | undefined> {
  if (pages.length === 0 && sections.length === 0) {
    return undefined;
  }

  const pageInsights = pages.slice(0, 3).map((page) => analyzeTemplatePage(page));
  const sectionSummaryLines = sections.slice(0, 6).map((section, index) => {
    const summary = truncateText(extractPlainText(section.content), 120);
    return `${index + 1}. ${section.pageName || 'unknown'} / ${section.type || 'section'}：${summary || '结构化区块'}`;
  });

  const htmlSnippetCandidates = pageInsights.flatMap((item) => item.snippetCandidates).slice(0, 8);

  const completedUsage = createEmptyTokenUsage();
  let stepCompleted = false;
  let streamedText = '';
  const system = `你是一名资深网页信息架构与设计分析专家。
你会收到一个模板网站的结构化信息与若干 HTML 片段。你的任务不是复述 HTML，也不是猜测代码意图，而是提炼出对“仿写一个相似但不完全一样的网站”真正有帮助的分析结论。

输出要求：
1. 只依据提供的页面信息、区块摘要和 HTML 片段进行分析，不要臆测不存在的视觉细节。
2. 输出使用中文，简洁但具体。
3. 严格使用以下结构：
结构骨架：
- ...

关键信息与标题线索：
- ...

视觉风格线索：
- ...

信息组织方式：
- ...

关键 HTML 片段：
- snippet-id | 这个片段在页面中的作用说明

实现约束：
- ...
4. 如果某项证据不足，就写“未明确”，不要编造。
5. “关键 HTML 片段”里最多选择 4 个 snippet-id；如果没有值得保留的片段，就写“未明确”。
6. “实现约束”里必须明确说明：可借鉴结构和风格，但不能直接复制品牌、文案、图片、链接或 DOM 实现。
7. “实现约束”里还必须明确说明：不要复用模板中依赖脚本解除隐藏的实现方式，例如先把主要内容设为 hidden、invisible、opacity-0 或 display:none 再显示。`;
  const prompt = `请分析以下模板网站：

模板名称：${templateName}
${templateDescription ? `模板简介：${templateDescription}` : ''}
${templatePreviewUrl ? `模板预览：${templatePreviewUrl}` : ''}

页面概览：
${pageInsights
  .map(
    (item, index) => `${index + 1}. ${item.name}（${item.title}）
- 标题线索：${item.headings.join('；') || '未明确'}
- 结构指标：${formatStructureMetrics(item.metrics)}`,
  )
  .join('\n')}

${sectionSummaryLines.length > 0 ? `区块摘要：\n${sectionSummaryLines.join('\n')}\n` : ''}

${
  htmlSnippetCandidates.length > 0
    ? `候选 HTML 片段：\n${htmlSnippetCandidates
        .map(
          (snippet, index) => `${index + 1}. ${snippet.id}（页面 ${snippet.pageName}）
- 内容预览：${snippet.preview || '未明确'}
- 结构指标：${formatStructureMetrics(snippet.metrics)}
\`\`\`html
${snippet.html}
\`\`\``,
        )
        .join('\n\n')}\n`
    : ''
}

请直接输出结构化分析结论。`;

  const result = streamText({
    model,
    system,
    prompt,
    abortSignal,
    onStepFinish: ({ usage }) => {
      stepCompleted = true;
      accumulateUsageSnapshot(completedUsage, usage);
    },
  });

  let analysisBody = '';

  try {
    analysisBody = await consumeStreamTextFullStream({
      fullStream: result.fullStream,
      abortSignal,
      onEvent: (event) => {
        streamedText = event.text;
        onStreamEvent?.(event);
      },
    });
  } catch (error) {
    if (isAbortError(error, abortSignal)) {
      if (!stepCompleted) {
        onAbortUsage?.(
          estimateTextStreamAbortUsage({
            system,
            prompt,
            streamedText,
          }),
        );
      } else {
        onAbortUsage?.(completedUsage);
      }
      throw createAbortError();
    }

    throw error;
  }

  const totalUsage = await result.totalUsage;
  const selectedHtmlSnippets = resolveSelectedHtmlSnippets(analysisBody, htmlSnippetCandidates);
  const analysis = [
    `参考模板：${templateName}`,
    templateDescription ? `模板简介：${templateDescription}` : undefined,
    templatePreviewUrl ? `模板预览：${templatePreviewUrl}` : undefined,
    '',
    analysisBody.trim(),
  ]
    .filter(Boolean)
    .join('\n');

  return {
    analysis,
    htmlSnippets:
      selectedHtmlSnippets.length > 0
        ? [
            '以下是从模板中截取并由 AI 选出的关键 HTML 片段，可用于参考真实结构与组件组织方式：',
            ...selectedHtmlSnippets.map(
              (snippet, index) =>
                `${index + 1}. 页面 ${snippet.pageName} / ${snippet.label}\n\`\`\`html\n${snippet.html}\n\`\`\``,
            ),
          ].join('\n\n')
        : undefined,
    totalUsage,
  };
}

function analyzeTemplatePage(page: TemplatePageInput) {
  const document = createTemplateDocument(page.content);
  const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
    .map((item) => normalizeText(item.textContent || ''))
    .filter(Boolean)
    .slice(0, 8);
  const children = Array.from(document.body.children) as HTMLElement[];
  const snippetCandidates = children
    .map((child, index) => buildHtmlSnippetCandidate(child, page.name, index))
    .filter((item): item is HtmlSnippetCandidate => Boolean(item));
  const fallbackCandidates =
    snippetCandidates.length > 0
      ? snippetCandidates
      : children
          .map((child, index) => buildFallbackSnippetCandidate(child, page.name, index))
          .filter((item): item is HtmlSnippetCandidate => Boolean(item))
          .slice(0, 3);
  const pageMetrics = collectElementMetrics(document.body as HTMLElement);

  return {
    name: page.name || 'index',
    title: page.title || '未命名页面',
    headings,
    metrics: pageMetrics,
    snippetCandidates: fallbackCandidates,
  };
}

function createTemplateDocument(html: string) {
  return new JSDOM(`<body>${html}</body>`).window.document;
}

function buildHtmlSnippetCandidate(
  element: HTMLElement,
  pageName: string,
  position: number,
): HtmlSnippetCandidate | null {
  const metrics = collectElementMetrics(element);
  const html = truncateText(minifyHtmlSnippet(element.outerHTML), 1800);
  const textContent = normalizeText(element.textContent || '');
  if (!html || !isStructurallyUsefulSnippet(metrics, html)) {
    return null;
  }

  return {
    id: `${pageName || 'page'}-snippet-${position + 1}`,
    pageName,
    html,
    metrics,
    preview: truncateText(textContent, 120),
  };
}

function buildFallbackSnippetCandidate(
  element: HTMLElement,
  pageName: string,
  position: number,
): HtmlSnippetCandidate | null {
  const metrics = collectElementMetrics(element);
  const html = truncateText(minifyHtmlSnippet(element.outerHTML), 1800);
  const textContent = normalizeText(element.textContent || '');
  if (!html || html.length < 120) {
    return null;
  }

  return {
    id: `${pageName || 'page'}-snippet-${position + 1}`,
    pageName,
    html,
    metrics,
    preview: truncateText(textContent, 120),
  };
}

function collectElementMetrics(element: HTMLElement): ElementStructureMetrics {
  const directChildren = Array.from(element.children) as HTMLElement[];

  return {
    textLength: normalizeText(element.textContent || '').length,
    headingCount: element.querySelectorAll('h1, h2, h3').length,
    hasH1: Boolean(element.querySelector('h1')),
    buttonLikeCount: element.querySelectorAll('button, [role="button"], a[href]').length,
    navCount: element.querySelectorAll('nav').length,
    listGroupCount: element.querySelectorAll('ul, ol, dl').length,
    listItemCount: element.querySelectorAll('li, dt, dd').length,
    articleCount: element.querySelectorAll('article').length,
    quoteCount: element.querySelectorAll('blockquote').length,
    detailsCount: element.querySelectorAll('details').length,
    formControlCount: element.querySelectorAll('input, textarea, select').length,
    mediaCount: element.querySelectorAll('img, picture, video').length,
    directChildCount: directChildren.length,
    repeatableCardCount: directChildren.filter(isRepeatableInfoBlock).length,
  };
}

function isRepeatableInfoBlock(element: HTMLElement) {
  const textLength = normalizeText(element.textContent || '').length;
  const headingCount = element.querySelectorAll('h2, h3, h4').length;
  const buttonLikeCount = element.querySelectorAll('button, [role="button"], a[href]').length;
  const listItemCount = element.querySelectorAll('li').length;

  return textLength >= 30 && (headingCount > 0 || buttonLikeCount > 0 || listItemCount >= 2);
}

function isStructurallyUsefulSnippet(metrics: ElementStructureMetrics, html: string) {
  const signalCount = [
    metrics.hasH1,
    metrics.headingCount > 0,
    metrics.buttonLikeCount > 0,
    metrics.navCount > 0,
    metrics.listGroupCount > 0,
    metrics.articleCount > 0,
    metrics.quoteCount > 0,
    metrics.detailsCount > 0,
    metrics.formControlCount > 0,
    metrics.mediaCount > 0,
    metrics.repeatableCardCount > 0,
  ].filter(Boolean).length;

  if (metrics.hasH1 || metrics.navCount > 0 || metrics.detailsCount > 0 || metrics.formControlCount > 0) {
    return true;
  }

  if (metrics.repeatableCardCount >= 2 || metrics.buttonLikeCount >= 2) {
    return true;
  }

  if (signalCount >= 2 && html.length >= 120) {
    return true;
  }

  return metrics.textLength >= 40 && html.length >= 160;
}

function extractPlainText(content?: string | null) {
  if (!content) {
    return '';
  }

  return content
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function minifyHtmlSnippet(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function truncateText(value: string, maxLength: number) {
  if (!value) {
    return '';
  }

  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function resolveSelectedHtmlSnippets(analysisBody: string, candidates: HtmlSnippetCandidate[]) {
  const section = extractNamedSection(analysisBody, '关键 HTML 片段');
  if (!section || section.includes('未明确')) {
    return [];
  }

  const seenIds = new Set<string>();

  return section
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim())
    .map((line) => {
      const [snippetId, ...labelParts] = line.split('|');
      const id = snippetId?.trim();
      const label = labelParts.join('|').trim() || '关键结构片段';
      const candidate = candidates.find((item) => item.id === id);
      if (!candidate || seenIds.has(candidate.id)) {
        return null;
      }
      seenIds.add(candidate.id);
      return {
        ...candidate,
        label,
      };
    })
    .filter((item): item is HtmlSnippetCandidate & { label: string } => Boolean(item))
    .slice(0, 4);
}

function extractNamedSection(content: string, title: string) {
  const lines = content.split('\n');
  const startIndex = lines.findIndex((line) => {
    const trimmed = line.trim();
    return trimmed === `${title}:` || trimmed === `${title}：`;
  });
  if (startIndex === -1) {
    return '';
  }

  const collected: string[] = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed) {
      if (collected.length > 0) {
        break;
      }
      continue;
    }
    if ((trimmed.endsWith(':') || trimmed.endsWith('：')) && !trimmed.startsWith('-')) {
      break;
    }
    collected.push(line);
  }

  return collected.join('\n').trim();
}

function formatStructureMetrics(metrics: ElementStructureMetrics) {
  return [
    `headingCount=${metrics.headingCount}`,
    `hasH1=${metrics.hasH1 ? 'yes' : 'no'}`,
    `buttonLikeCount=${metrics.buttonLikeCount}`,
    `navCount=${metrics.navCount}`,
    `listGroupCount=${metrics.listGroupCount}`,
    `listItemCount=${metrics.listItemCount}`,
    `articleCount=${metrics.articleCount}`,
    `quoteCount=${metrics.quoteCount}`,
    `detailsCount=${metrics.detailsCount}`,
    `formControlCount=${metrics.formControlCount}`,
    `mediaCount=${metrics.mediaCount}`,
    `repeatableCardCount=${metrics.repeatableCardCount}`,
    `directChildCount=${metrics.directChildCount}`,
  ].join(', ');
}
