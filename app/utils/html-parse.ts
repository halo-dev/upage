import { createScopedLogger } from './logger';

const logger = createScopedLogger('htmlParse');

export function isScriptContent(content: string): boolean {
  return content.trim().startsWith('<script');
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

  // 处理可能存在的不完整标签
  content = sanitizeHtmlContent(content);

  try {
    // 创建一个临时的 DOM 解析器
    const parser = new DOMParser();
    const doc = parser.parseFromString(content, 'text/html');

    // 检查内容类型
    if (content.trim().startsWith('<script')) {
      // JavaScript 内容验证
      const scriptElements = doc.getElementsByTagName('script');

      if (scriptElements.length !== 1) {
        logger.warn('JS content must have exactly one script element', {
          contentLength: content.length,
          elementCount: scriptElements.length,
        });
        return false;
      }

      const scriptElement = scriptElements[0];

      // 检查脚本元素是否有 id 属性
      if (!scriptElement.id) {
        logger.warn('JS content must have an id attribute on the script element', { contentLength: content.length });
        return false;
      }

      // 检查 id 是否完整，即属性在原始内容中是否以 id="..." 或 id='...' 的形式完整出现
      if (content.indexOf(`id="${scriptElement.id}"`) === -1 && content.indexOf(`id='${scriptElement.id}'`) === -1) {
        logger.warn('JS content contains incomplete id attribute', { contentLength: content.length });
        return false;
      }

      // 检查 script 标签是否有完整的闭合标签
      if (!content.includes('</script>')) {
        logger.warn('JS content must have closing </script> tag', { contentLength: content.length });
        return false;
      }

      return true;
    }

    if (content.trim().startsWith('<style')) {
      // CSS 内容验证
      const styleElements = doc.getElementsByTagName('style');

      if (styleElements.length !== 1) {
        logger.warn('CSS content must have exactly one style element', {
          contentLength: content.length,
          elementCount: styleElements.length,
        });
        return false;
      }

      const styleElement = styleElements[0];

      // 检查样式元素是否有 id 属性
      if (!styleElement.id) {
        logger.warn('CSS content must have an id attribute on the style element', { contentLength: content.length });
        return false;
      }

      if (content.indexOf(`id="${styleElement.id}"`) === -1 && content.indexOf(`id='${styleElement.id}'`) === -1) {
        logger.warn('CSS content contains incomplete id attribute', { contentLength: content.length });
        return false;
      }

      // 检查 style 标签是否有完整的闭合标签
      if (!content.includes('</style>')) {
        logger.warn('style content must have closing </style> tag');
        return false;
      }

      return true;
    }

    // HTML 内容验证
    const bodyChildren = doc.body.children;

    if (bodyChildren.length !== 1) {
      logger.warn('HTML content must have exactly one root element', {
        contentLength: content.length,
        rootCount: bodyChildren.length,
      });
      return false;
    }

    const rootElement = bodyChildren[0];

    // 检查根元素是否有 id 属性
    if (!rootElement.id) {
      logger.warn('HTML content must have an id attribute on the root element');
      return false;
    }

    if (content.indexOf(`id="${rootElement.id}"`) === -1 && content.indexOf(`id='${rootElement.id}'`) === -1) {
      logger.warn('HTML content contains incomplete id attribute');
      return false;
    }

    return true;
  } catch (error) {
    logger.error('Error validating content', error);
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
      'Incomplete tag detected at the end of content',
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
      'Potential unbalanced tags detected',
      JSON.stringify({
        openTagsCount: openTags.length,
        closeTagsCount: closeTags.length,
      }),
    );
  }

  return content;
}
