import type { PageData } from '~/types/pages';
import type { SelectContextResult } from './select-context';

const MAX_PAGE_PREVIEW_CHARS = 640;
const MAX_CONTEXT_SECTION_CHARS = 1800;
const MAX_SNAPSHOT_OUTLINE_CHARS = 1200;
const MAX_SNAPSHOT_DETAIL_CHARS = 2400;
const MAX_SELECTED_PAGES = 3;
const MAX_SNAPSHOT_BLOCKS = 8;

export type PageSelectionCandidate = {
  name: string;
  title: string;
  preview: string;
  contentLength: number;
  actionCount: number;
};

export function buildPageSelectionCandidates(pages: PageData[]): PageSelectionCandidate[] {
  return pages.map((page) => ({
    name: page.name,
    title: page.title,
    preview: createPagePreview(page.content),
    contentLength: page.content.length,
    actionCount: page.actionIds.length,
  }));
}

export function resolveSelectedPages(pages: PageData[], selectedPageNames: string[], maxPages = MAX_SELECTED_PAGES) {
  const pagesByName = new Map(pages.map((page) => [page.name, page] as const));
  const matchedPages =
    selectedPageNames.length > 0
      ? selectedPageNames.map((pageName) => pagesByName.get(pageName)).filter((page): page is PageData => Boolean(page))
      : pages.slice(0, maxPages);

  if (matchedPages.length === 0 && pages.length > 0) {
    return pages.slice(0, maxPages);
  }

  return matchedPages.slice(0, maxPages);
}

export function buildContextFromPages(pages: PageData[]): Record<string, SelectContextResult> {
  return Object.fromEntries(
    pages.map((page) => [
      page.name,
      {
        pageName: page.name,
        pageTitle: page.title,
        sections: extractContextSections(stripPageScriptsAndStyles(page.content)),
      },
    ]),
  );
}

export function createPagePreview(content: string, maxChars = MAX_PAGE_PREVIEW_CHARS) {
  const normalized = content
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return '页面内容为空';
  }

  return normalized.slice(0, maxChars);
}

export function buildSnapshotOutlineContent(page: Pick<PageData, 'name' | 'title' | 'content'>) {
  const sanitized = stripPageScriptsAndStyles(page.content);
  const preview = createPagePreview(sanitized, MAX_SNAPSHOT_OUTLINE_CHARS);
  const structuralBlocks = extractStructuralBlocks(sanitized);
  const headings = extractHeadingTexts(sanitized);
  const forms = countTagMatches(sanitized, 'form');
  const buttons = countTagMatches(sanitized, 'button');
  const links = countTagMatches(sanitized, 'a');
  const tables = countTagMatches(sanitized, 'table');

  return [
    `页面标题：${page.title}`,
    `页面名称：${page.name}`,
    `页面概览：${preview}`,
    `主要结构：${structuralBlocks.length > 0 ? structuralBlocks.join('、') : '未识别到明显结构块'}`,
    `主要标题：${headings.length > 0 ? headings.join('、') : '未识别到明显标题'}`,
    `互动元素：表单 ${forms} 个，按钮 ${buttons} 个，链接 ${links} 个，表格 ${tables} 个`,
  ].join('\n');
}

export function buildSnapshotDetailedContent(page: Pick<PageData, 'name' | 'title' | 'content'>) {
  const sanitized = stripPageScriptsAndStyles(page.content);
  const sections = extractContextSections(sanitized, MAX_SNAPSHOT_DETAIL_CHARS);

  return [`页面标题：${page.title}`, `页面名称：${page.name}`, '页面内容片段：', ...sections].join('\n');
}

export function extractContextSections(content: string, maxChars = MAX_CONTEXT_SECTION_CHARS) {
  const normalized = content.trim();
  if (!normalized) {
    return ['页面内容为空'];
  }

  if (normalized.length <= maxChars) {
    return [normalized];
  }

  const start = normalized.slice(0, maxChars);
  const end = normalized.slice(-Math.min(maxChars / 2, normalized.length));

  return [start, `...省略 ${normalized.length - start.length - end.length} 个字符...`, end];
}

function stripPageScriptsAndStyles(content: string) {
  return content
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .trim();
}

function extractStructuralBlocks(content: string) {
  const blocks: string[] = [];
  const regex = /<(header|main|section|article|nav|aside|footer|form)\b[^>]*?(?:\sid=(["'])([^"']+)\2)?[^>]*>/gi;

  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null && blocks.length < MAX_SNAPSHOT_BLOCKS) {
    const tagName = match[1]?.toLowerCase();
    const domId = match[3];
    blocks.push(domId ? `${tagName}#${domId}` : tagName);
  }

  return [...new Set(blocks)];
}

function extractHeadingTexts(content: string) {
  const headings: string[] = [];
  const regex = /<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi;

  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null && headings.length < 6) {
    const text = match[1]
      ?.replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) {
      headings.push(text);
    }
  }

  return headings;
}

function countTagMatches(content: string, tagName: string) {
  return [...content.matchAll(new RegExp(`<${tagName}\\b`, 'gi'))].length;
}
