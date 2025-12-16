import { createScopedLogger } from '~/.client/utils/logger';
import type { PageAssetData, PageData, PageHeadLink, PageHeadMeta, PageHeadScript, PageHeadStyle } from '~/types/pages';
import { replaceRelativePathsWithUrls } from './asset-path-converter';

const logger = createScopedLogger('htmlParse');

export function isScriptContent(content: string): boolean {
  return content.trim().startsWith('<script');
}

/**
 * Convert page's head attribute to HEAD HTML string
 * Automatically handles path conversion (relative path -> URL)
 *
 * @param page page data
 * @returns HEAD HTML string
 */
export function convertPageHeadToHTML(page: PageData): string {
  const headParts: string[] = [];
  const pageWithAssets = page as typeof page & { assets?: PageAssetData[] };
  const assets = pageWithAssets.assets || [];

  if (page.title) {
    headParts.push(`<title>${escapeHTML(page.title)}</title>`);
  }

  if (page.headMeta && Array.isArray(page.headMeta)) {
    for (const meta of page.headMeta) {
      headParts.push(convertMetaToHTML(meta, assets));
    }
  }

  if (page.headLinks && Array.isArray(page.headLinks)) {
    for (const link of page.headLinks) {
      headParts.push(convertLinkToHTML(link, assets));
    }
  }

  if (page.headStyles && Array.isArray(page.headStyles)) {
    for (const style of page.headStyles) {
      headParts.push(convertStyleToHTML(style, assets));
    }
  }

  if (page.headScripts && Array.isArray(page.headScripts)) {
    for (const script of page.headScripts) {
      headParts.push(convertScriptToHTML(script, assets));
    }
  }

  if (page.headRaw && typeof page.headRaw === 'string') {
    const convertedRaw = assets.length > 0 ? replaceRelativePathsWithUrls(page.headRaw, assets) : page.headRaw;
    headParts.push(convertedRaw);
  }

  return headParts.join('\n');
}

function convertMetaToHTML(meta: PageHeadMeta, assets: PageAssetData[]): string {
  const attrs: string[] = [];

  for (const [key, value] of Object.entries(meta)) {
    if (value !== undefined && value !== null) {
      let finalValue = String(value);

      if (key === 'content' && assets.length > 0) {
        const matchedAsset = assets.find((asset) => {
          const normalizedFilename = asset.filename.replace(/^\.?\/?/, '');
          const normalizedValue = finalValue.replace(/^\.?\/?/, '');
          return normalizedValue === normalizedFilename || normalizedValue.endsWith(`/${normalizedFilename}`);
        });
        if (matchedAsset) {
          finalValue = matchedAsset.url;
        }
      }

      attrs.push(`${key}="${escapeHTML(finalValue)}"`);
    }
  }

  return `<meta ${attrs.join(' ')}>`;
}

function convertLinkToHTML(link: PageHeadLink, assets: PageAssetData[]): string {
  const attrs: string[] = [];

  for (const [key, value] of Object.entries(link)) {
    if (value !== undefined && value !== null) {
      let finalValue = String(value);

      if (key === 'href' && assets.length > 0) {
        const matchedAsset = assets.find((asset) => {
          const normalizedFilename = asset.filename.replace(/^\.?\/?/, '');
          const normalizedHref = finalValue.replace(/^\.?\/?/, '');
          return normalizedHref === normalizedFilename || normalizedHref.endsWith(`/${normalizedFilename}`);
        });
        if (matchedAsset) {
          finalValue = matchedAsset.url;
        }
      }

      attrs.push(`${key}="${escapeHTML(finalValue)}"`);
    }
  }

  return `<link ${attrs.join(' ')}>`;
}

function convertStyleToHTML(style: PageHeadStyle, assets: PageAssetData[]): string {
  let content = style.content;

  if (assets.length > 0) {
    content = replaceRelativePathsWithUrls(content, assets);
  }

  const attrs: string[] = [];
  if (style.media) {
    attrs.push(`media="${escapeHTML(style.media)}"`);
  }

  for (const [key, value] of Object.entries(style)) {
    if (key !== 'content' && key !== 'media' && value !== undefined && value !== null) {
      attrs.push(`${key}="${escapeHTML(String(value))}"`);
    }
  }

  const attrString = attrs.length > 0 ? ` ${attrs.join(' ')}` : '';
  return `<style${attrString}>\n${content}\n</style>`;
}

function convertScriptToHTML(script: PageHeadScript, assets: PageAssetData[]): string {
  const attrs: string[] = [];
  let hasContent = false;
  let content = '';

  for (const [key, value] of Object.entries(script)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (key === 'content') {
      hasContent = true;
      content = String(value);
      continue;
    }

    if (key === 'src') {
      let srcValue = String(value);
      if (assets.length > 0) {
        const matchedAsset = assets.find((asset) => {
          const normalizedFilename = asset.filename.replace(/^\.?\/?/, '');
          const normalizedSrc = srcValue.replace(/^\.?\/?/, '');
          return normalizedSrc === normalizedFilename || normalizedSrc.endsWith(`/${normalizedFilename}`);
        });
        if (matchedAsset) {
          srcValue = matchedAsset.url;
        }
      }
      attrs.push(`src="${escapeHTML(srcValue)}"`);
      continue;
    }

    if (typeof value === 'boolean') {
      if (value) {
        attrs.push(key);
      }
    } else {
      attrs.push(`${key}="${escapeHTML(String(value))}"`);
    }
  }

  const attrString = attrs.length > 0 ? ` ${attrs.join(' ')}` : '';

  if (hasContent) {
    return `<script${attrString}>\n${content}\n</script>`;
  }
  return `<script${attrString}></script>`;
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 验证第一个标签（根节点）的完整性
 * @param content 内容字符串
 * @returns 验证结果，包括是否有效、根元素 id 和标签名
 */
function validateRootTagCompleteness(content: string): { valid: boolean; rootId?: string; tagName?: string } {
  const trimmedContent = content.trim();

  if (!trimmedContent.startsWith('<')) {
    logger.warn('内容不以标签开始');
    return { valid: false };
  }

  // 查找第一个完整的开始标签（找到第一个 >）
  const firstTagEndIndex = trimmedContent.indexOf('>');

  if (firstTagEndIndex === -1) {
    logger.warn('根标签不完整：未找到闭合的 >');
    return { valid: false };
  }

  // 提取第一个完整的标签（包括 >）
  const firstTag = trimmedContent.substring(0, firstTagEndIndex + 1);

  // 提取标签名称（支持 <tagName 或 <tagName空格 的形式）
  const tagNameMatch = firstTag.match(/^<([a-zA-Z][a-zA-Z0-9]*)/);

  if (!tagNameMatch) {
    logger.warn('无法提取标签名称');
    return { valid: false };
  }

  const tagName = tagNameMatch[1];

  // 验证 id 属性是否存在且完整
  // 支持 id="..." 或 id='...' 两种形式
  const idPattern = /id=["']([^"']+)["']/;
  const idMatch = firstTag.match(idPattern);

  if (!idMatch) {
    logger.warn('根标签缺少完整的 id 属性', { tagName });
    return { valid: false };
  }

  const rootId = idMatch[1];

  return { valid: true, rootId, tagName };
}

/**
 * 验证指定标签的闭合标签是否完整
 * @param content 内容字符串
 * @param tagName 标签名称
 * @returns 是否存在完整的闭合标签
 */
function validateClosingTag(content: string, tagName: string): boolean {
  const closingTag = `</${tagName}>`;
  return content.includes(closingTag);
}

/**
 * 检查内容中是否存在明显不完整的标签
 * @param content 内容字符串
 * @returns 是否存在不完整的标签
 */
function hasIncompleteTag(content: string): boolean {
  // 检查内容末尾是否有不完整的闭合标签
  // 匹配 </、</d、</div 等（没有 > 的闭合标签）
  const incompleteClosingTagPattern = /<\/([a-zA-Z][a-zA-Z0-9]*)?$/;

  if (incompleteClosingTagPattern.test(content)) {
    logger.warn('检测到不完整的闭合标签', { contentEnd: content.slice(-20) });
    return true;
  }

  // 检查内容末尾是否有不完整的开始标签
  // 匹配以 < 开头但没有对应 > 的情况
  const incompleteOpeningTagPattern = /<[a-zA-Z][^>]*$/;

  if (incompleteOpeningTagPattern.test(content)) {
    logger.warn('检测到不完整的开始标签', { contentEnd: content.slice(-20) });
    return true;
  }

  // 检查内容末尾是否有孤立的 <
  // 匹配末尾单独的 < 字符（不属于任何标签）
  const isolatedLessThanPattern = /<$/;

  if (isolatedLessThanPattern.test(content)) {
    logger.warn('检测到末尾孤立的 < 字符', { contentEnd: content.slice(-20) });
    return true;
  }

  return false;
}

/**
 * 验证内容是否有效
 * - 检查是否包含完整的 id 属性
 * - 检查是否符合内容类型要求（HTML、JS、CSS）
 * @param content 内容字符串
 * @returns {boolean} 内容是否有效
 */
export function isValidContent(content: string): boolean {
  if (!content || typeof content !== 'string') {
    return false;
  }

  // 检查是否存在明显不完整的标签
  if (hasIncompleteTag(content)) {
    logger.warn('内容包含不完整的标签');
    return false;
  }

  // 验证根节点标签完整性
  const rootValidation = validateRootTagCompleteness(content);
  if (!rootValidation.valid) {
    logger.warn('根节点标签验证失败');
    return false;
  }

  const { rootId } = rootValidation;

  try {
    // 创建一个临时的 DOM 解析器
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');

    // 检查内容类型
    if (content.trim().startsWith('<script')) {
      // 对于 script，验证闭合标签完整性
      if (!validateClosingTag(content, 'script')) {
        logger.warn('script 标签缺少完整的闭合标签 </script>');
        return false;
      }

      // JavaScript 内容验证
      const scriptElements = doc.getElementsByTagName('script');

      if (scriptElements.length !== 1) {
        logger.warn('JS 内容必须有且只有一个 script 元素', {
          contentLength: content.length,
          elementCount: scriptElements.length,
        });
        return false;
      }

      const scriptElement = scriptElements[0];

      // 检查脚本元素是否有 id 属性
      if (!scriptElement.id) {
        logger.warn('JS 内容必须有 id 属性在 script 元素上', { contentLength: content.length });
        return false;
      }

      // 验证提取的 id 与 DOMParser 解析的 id 一致
      if (scriptElement.id !== rootId) {
        logger.warn('script 标签 id 不一致', {
          extractedId: rootId,
          parsedId: scriptElement.id,
        });
        return false;
      }

      return true;
    }

    if (content.trim().startsWith('<style')) {
      // 对于 style，验证闭合标签完整性
      if (!validateClosingTag(content, 'style')) {
        logger.warn('style 标签缺少完整的闭合标签 </style>');
        return false;
      }

      // CSS 内容验证
      const styleElements = doc.getElementsByTagName('style');

      if (styleElements.length !== 1) {
        logger.warn('CSS 内容必须有且只有一个 style 元素', {
          contentLength: content.length,
          elementCount: styleElements.length,
        });
        return false;
      }

      const styleElement = styleElements[0];

      // 检查样式元素是否有 id 属性
      if (!styleElement.id) {
        logger.warn('CSS 内容必须有 id 属性在 style 元素上', { contentLength: content.length });
        return false;
      }

      // 验证提取的 id 与 DOMParser 解析的 id 一致
      if (styleElement.id !== rootId) {
        logger.warn('style 标签 id 不一致', {
          extractedId: rootId,
          parsedId: styleElement.id,
        });
        return false;
      }

      return true;
    }

    // HTML 内容验证
    const bodyChildren = doc.body.children;

    if (bodyChildren.length !== 1) {
      logger.warn('HTML 内容必须有且只有一个根元素', {
        contentLength: content.length,
        rootCount: bodyChildren.length,
      });
      return false;
    }

    const rootElement = bodyChildren[0];

    // 检查根元素是否有 id 属性
    if (!rootElement.id) {
      logger.warn('HTML 内容必须有 id 属性在根元素上');
      return false;
    }

    // 验证提取的 id 与 DOMParser 解析的 id 一致
    if (rootElement.id !== rootId) {
      logger.warn('HTML 根元素 id 不一致', {
        extractedId: rootId,
        parsedId: rootElement.id,
      });
      return false;
    }

    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`验证内容失败: ${errorMessage}`);
    return false;
  }
}

/**
 * 处理可能存在的不完整内容
 * 特别处理末尾可能存在的不完整标签如 </
 * @param content 内容字符串
 * @returns {string} 处理后的内容
 */
export function sanitizeHtmlContent(content: string): string {
  if (!content) {
    return content;
  }

  // 检查是否以不完整的标签结尾
  const incompleteEndingRegex = /<\/?[a-zA-Z][a-zA-Z0-9]*$/;

  if (incompleteEndingRegex.test(content)) {
    // 移除不完整的结束标签
    logger.warn(
      '检测到末尾不完整的标签',
      JSON.stringify({
        contentEnd: content.slice(-10),
        contentLength: content.length,
      }),
    );
    return content.replace(incompleteEndingRegex, '');
  }

  // 检查是否有不匹配的标签 (简单检查)
  const openTags = content.match(/<[a-zA-Z][^>]*>/g) || [];
  const closeTags = content.match(/<\/[a-zA-Z][^>]*>/g) || [];

  if (openTags.length !== closeTags.length) {
    logger.warn(
      '检测到不匹配的标签',
      JSON.stringify({
        openTagsCount: openTags.length,
        closeTagsCount: closeTags.length,
      }),
    );
  }

  return content;
}
