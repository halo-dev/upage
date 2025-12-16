import { JSDOM } from 'jsdom';
import { base64ToBinary, getExtensionFromMimeType } from '~/utils/file-utils';
import { createScopedLogger } from './logger';

const logger = createScopedLogger('resource-extractor');

/**
 * Resource information interface
 */
export interface ExtractedResource {
  // original path (path in HTML)
  originalPath: string;
  // resource type ('data-url' | 'local' | 'remote' | 'anchor')
  type: 'data-url' | 'local' | 'remote' | 'anchor';
  // content type of data URL (if it is a data URL)
  mimeType?: string;
  // base64 content of data URL (if it is a data URL)
  base64Content?: string;
  // binary content (if it is a data URL, decoded)
  binaryContent?: Buffer;
  // suggested filename
  suggestedFilename?: string;
  // element information in HTML
  element: {
    tagName: string;
    attribute: string;
  };
}

/**
 * Extract all resources references from HTML string
 * @param html HTML string
 * @returns extracted resources array
 */
export function extractResourcesFromHTML(html: string): ExtractedResource[] {
  const resources: ExtractedResource[] = [];

  try {
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // collect all elements and attributes that may contain resource references
    const resourceSelectors = [
      { selector: '[src]', attribute: 'src' },
      { selector: '[href]', attribute: 'href' },
      { selector: '[data-src]', attribute: 'data-src' },
      { selector: '[data-href]', attribute: 'data-href' },
      { selector: '[background]', attribute: 'background' },
    ];

    for (const { selector, attribute } of resourceSelectors) {
      const elements = document.querySelectorAll(selector);

      elements.forEach((element) => {
        const value = element.getAttribute(attribute);
        if (!value) {
          return;
        }

        // skip special values
        if (value === '#' || value === 'javascript:void(0)' || value === 'javascript:;') {
          return;
        }

        const resource = analyzeResourceUrl(value, element.tagName, attribute);
        if (resource) {
          resources.push(resource);
        }
      });
    }

    // extract background-image etc. from inline styles
    const elementsWithStyle = document.querySelectorAll('[style]');
    elementsWithStyle.forEach((element) => {
      const style = element.getAttribute('style');
      if (style) {
        const urlMatches = style.matchAll(/url\(['"]?([^'"()]+)['"]?\)/g);
        for (const match of urlMatches) {
          const url = match[1];
          const resource = analyzeResourceUrl(url, element.tagName, 'style');
          if (resource) {
            resources.push(resource);
          }
        }
      }
    });

    logger.debug(`从 HTML 中提取了 ${resources.length} 个资源引用`);
    return resources;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`提取资源失败: ${errorMessage}`);
    return [];
  }
}

/**
 * Analyze resource URL and return resource information
 * @param url resource URL
 * @param tagName element tag name
 * @param attribute attribute name
 * @returns resource information or null
 */
function analyzeResourceUrl(url: string, tagName: string, attribute: string): ExtractedResource | null {
  // determine resource type
  if (url.startsWith('data:')) {
    return analyzeDataUrl(url, tagName, attribute);
  }

  if (url.startsWith('#')) {
    return {
      originalPath: url,
      type: 'anchor',
      element: {
        tagName,
        attribute,
      },
    };
  }

  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) {
    return {
      originalPath: url,
      type: 'remote',
      element: {
        tagName,
        attribute,
      },
    };
  }

  // local path (relative or absolute path)
  return {
    originalPath: url,
    type: 'local',
    element: {
      tagName,
      attribute,
    },
  };
}

/**
 * Analyze data URL
 * @param dataUrl data URL
 * @param tagName element tag name
 * @param attribute attribute name
 * @returns resource information
 */
function analyzeDataUrl(dataUrl: string, tagName: string, attribute: string): ExtractedResource | null {
  try {
    // parse data URL: data:[<mediatype>][;base64],<data>
    const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.+)$/);
    if (!match) {
      logger.warn(`无效的 data URL: ${dataUrl.substring(0, 50)}...`);
      return null;
    }

    const mimeType = match[1] || 'application/octet-stream';
    const isBase64 = !!match[2];
    const data = match[3];

    if (!isBase64) {
      logger.warn('暂不支持非 base64 的 data URL');
      return null;
    }

    const binaryContent = Buffer.from(base64ToBinary(data), 'binary');
    const extension = getExtensionFromMimeType(mimeType);
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const suggestedFilename = `resource_${timestamp}_${randomStr}${extension ? `.${extension}` : ''}`;

    return {
      originalPath: dataUrl,
      type: 'data-url',
      mimeType,
      base64Content: data,
      binaryContent,
      suggestedFilename,
      element: {
        tagName,
        attribute,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`解析 data URL 失败: ${errorMessage}`);
    return null;
  }
}

/**
 * Extract all local resources that need to be processed (excluding remote resources and anchors)
 * @param html HTML string
 * @returns resources that need to be processed
 */
export function extractLocalResources(html: string): ExtractedResource[] {
  const allResources = extractResourcesFromHTML(html);
  return allResources.filter((resource) => resource.type === 'data-url' || resource.type === 'local');
}

/**
 * Extract all data URL resources
 * @param html HTML string
 * @returns data URL resources array
 */
export function extractDataUrlResources(html: string): ExtractedResource[] {
  const allResources = extractResourcesFromHTML(html);
  return allResources.filter((resource) => resource.type === 'data-url');
}

/**
 * Replace resource paths in HTML
 * @param html original HTML
 * @param replacements path replacement mapping (original path -> new path)
 * @returns replaced HTML
 */
export function replaceResourcePaths(html: string, replacements: Map<string, string>): string {
  let updatedHtml = html;

  for (const [originalPath, newPath] of replacements.entries()) {
    const escapedPath = originalPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const patterns = [
      // src="path" 或 href="path"
      new RegExp(`(src|href|data-src|data-href|background)=["']${escapedPath}["']`, 'g'),
      // style="...url(path)..."
      new RegExp(`url\\(["']?${escapedPath}["']?\\)`, 'g'),
    ];

    for (const pattern of patterns) {
      updatedHtml = updatedHtml.replace(pattern, (match) => {
        if (match.includes('url(')) {
          return `url("${newPath}")`;
        }
        return match.replace(originalPath, newPath);
      });
    }
  }

  return updatedHtml;
}
