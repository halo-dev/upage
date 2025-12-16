import * as fs from 'node:fs';
import * as path from 'node:path';
import type { PageV2 } from '@prisma/client';
import { JSDOM } from 'jsdom';
import { createScopedLogger } from '~/.server/utils/logger';
import type { Page } from '~/types/actions';
import type { PageHeadLink, PageHeadMeta, PageHeadScript, PageHeadStyle } from '~/types/pages';
import { storageProvider } from '../storage/index.server';
import { getPageByMessageId } from './page';
import { getAssetsByPageId } from './page-asset';
import { getPageV2ByMessageId, getPageV2ByMessageIdAndName } from './page-v2';

const logger = createScopedLogger('files-generator');

export interface GenerateHTMLParams {
  messageId: string;
  attachBody?: string;
  pageName?: string;
  inner?: boolean;
}

/**
 * Exported file mapping
 * key: file path (e.g. "index.html", "assets/style.css")
 * value: file content (string or Buffer)
 */
export type ExportedFiles = Record<string, string | Buffer>;

/**
 * Asset file information
 */
export interface AssetFileInfo {
  // original filename
  filename: string;
  // path in exported package (e.g. "assets/style.css")
  exportPath: string;
  // file content
  content: Buffer | string;
  // file type
  fileType: string;
}

/**
 * Read file content from storage service
 * @param storagePath storage path (relative to baseDir)
 * @returns file content
 */
async function readFileContent(storagePath: string): Promise<Buffer | string> {
  try {
    const content = await storageProvider.getFileContent(storagePath);

    // check if it is a text file
    const textExtensions = ['.html', '.css', '.js', '.json', '.txt', '.md', '.xml', '.svg', '.yaml', '.yml'];
    const isText = textExtensions.some((ext) => storagePath.endsWith(ext));

    return isText ? content.toString('utf-8') : content;
  } catch (error) {
    logger.error(`读取文件失败: ${storagePath}`, error);
    throw error;
  }
}

/**
 * Convert asset paths in HTML
 * @param html original HTML
 * @param inner whether it is an internal page
 * @returns converted HTML
 */
function convertAssetPaths(html: string, inner: boolean): string {
  if (inner) {
    return html;
  }

  // external export, convert /uploads/assets/userId/messageId/filename to relative path ./assets/filename
  // match /uploads/ in src="..." and href="..."
  let result = html;

  // handle /uploads/assets/xxx/xxx/filename format
  result = result.replace(
    /(\s(?:src|href|data-src|data-href|background))=["']\/uploads\/assets\/[^\/]+\/[^\/]+\/([^"']+)["']/gi,
    '$1="./assets/$2"',
  );

  // handle other formats of /uploads/... (compatibility)
  result = result.replace(
    /(\s(?:src|href|data-src|data-href|background))=["']\/uploads\/([^"']+)["']/gi,
    '$1="./assets/$2"',
  );

  // handle already /assets/... paths
  result = result.replace(
    /(\s(?:src|href|data-src|data-href|background))=["']\/assets\/([^"']+)["']/gi,
    '$1="./assets/$2"',
  );

  // handle url() in inline styles
  result = result.replace(/url\(["']?\/uploads\/assets\/[^\/]+\/[^\/]+\/([^"')]+)["']?\)/gi, 'url("./assets/$1")');
  result = result.replace(/url\(["']?\/uploads\/([^"')]+)["']?\)/gi, 'url("./assets/$1")');
  result = result.replace(/url\(["']?\/assets\/([^"')]+)["']?\)/gi, 'url("./assets/$1")');

  return result;
}

/**
 * Render HTML head elements from PageV2 headInfo
 * @param document JSDOM document
 * @param pageV2 PageV2 data
 */
function renderHeadFromPageV2(document: Document, pageV2: any): void {
  const head = document.head;

  const metaCharset = document.createElement('meta');
  metaCharset.setAttribute('charset', 'UTF-8');
  head.appendChild(metaCharset);

  const metaViewport = document.createElement('meta');
  metaViewport.setAttribute('name', 'viewport');
  metaViewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
  head.appendChild(metaViewport);

  const title = document.createElement('title');
  title.textContent = pageV2.title || 'UPage Generated Page';
  head.appendChild(title);

  if (pageV2.headMeta) {
    const metas = pageV2.headMeta as PageHeadMeta[];
    for (const metaData of metas) {
      const meta = document.createElement('meta');
      for (const [key, value] of Object.entries(metaData)) {
        if (value !== undefined) {
          meta.setAttribute(key, String(value));
        }
      }
      head.appendChild(meta);
    }
  }

  if (pageV2.headLinks) {
    const links = pageV2.headLinks as PageHeadLink[];
    for (const linkData of links) {
      const link = document.createElement('link');
      for (const [key, value] of Object.entries(linkData)) {
        if (value !== undefined) {
          link.setAttribute(key, String(value));
        }
      }
      head.appendChild(link);
    }
  }

  if (pageV2.headScripts) {
    const scripts = pageV2.headScripts as PageHeadScript[];
    for (const scriptData of scripts) {
      const script = document.createElement('script');

      if (scriptData.src) {
        script.setAttribute('src', scriptData.src);
      } else if (scriptData.content) {
        script.textContent = scriptData.content;
      }

      if (scriptData.type) {
        script.setAttribute('type', scriptData.type);
      }
      if (scriptData.async) {
        script.setAttribute('async', '');
      }
      if (scriptData.defer) {
        script.setAttribute('defer', '');
      }

      head.appendChild(script);
    }
  }

  if (pageV2.headStyles) {
    const styles = pageV2.headStyles as PageHeadStyle[];
    for (const styleData of styles) {
      const style = document.createElement('style');
      style.textContent = styleData.content;

      if (styleData.media) {
        style.setAttribute('media', styleData.media);
      }

      head.appendChild(style);
    }
  }

  if (pageV2.headRaw) {
    const rawDiv = document.createElement('div');
    rawDiv.innerHTML = pageV2.headRaw;

    while (rawDiv.firstChild) {
      head.appendChild(rawDiv.firstChild);
    }
  }

  if (!head.querySelector('script[src*="tailwindcss.js"]')) {
    const tailwindScript = document.createElement('script');
    tailwindScript.setAttribute('src', 'tailwindcss.js');
    head.appendChild(tailwindScript);
  }

  if (!head.querySelector('script[src*="iconify-icon.min.js"]')) {
    const iconifyScript = document.createElement('script');
    iconifyScript.setAttribute('src', 'iconify-icon.min.js');
    head.appendChild(iconifyScript);
  }
}

/**
 * Generate HTML file from PageV2
 *
 * PageV2 allows customizing Head content in Page and having independent resource management.
 * @param pageV2 PageV2 data
 * @param params generate parameters
 * @returns HTML string
 */
export async function generateHTMLFromPageV2(pageV2: PageV2, params: GenerateHTMLParams): Promise<string> {
  const { messageId, attachBody, pageName, inner = false } = params;
  logger.debug(`使用 PageV2 生成 HTML: messageId=${messageId}, pageName=${pageName}, inner=${inner}`);

  const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>');
  const document = dom.window.document;
  const body = document.body;

  renderHeadFromPageV2(document, pageV2);

  body.insertAdjacentHTML('beforeend', pageV2.content);
  if (attachBody) {
    body.insertAdjacentHTML('beforeend', attachBody);
  }

  const html = convertAssetPaths(dom.serialize(), inner);
  logger.info(`使用 PageV2 成功生成 HTML: page=${pageName}`);
  return html;
}

/**
 * Generate HTML file from Page V1
 * @param page Page V1 data
 * @param params generate parameters
 * @returns HTML string
 */
export async function generateHTMLFromPageV1(page: Page, params: GenerateHTMLParams): Promise<string> {
  const { inner = false, attachBody } = params;

  const doc = createProjectHead(page, inner ? 'relative' : 'absolute', attachBody);

  const dom = new JSDOM('<!DOCTYPE html><html><head></head><body></body></html>');
  doc.body.innerHTML = page.content || '';

  return dom.serialize();
}

/**
 * Generate HTML file from Page (automatically detect version)
 * @returns HTML string
 */
export async function generateHTMLFromPages(params: GenerateHTMLParams): Promise<Record<string, string>> {
  const { messageId, pageName } = params;

  try {
    // first try to query PageV2 (new version)
    const htmlRecord: Record<string, string> = {};
    if (pageName) {
      const pageV2 = await getPageV2ByMessageIdAndName(messageId, pageName);
      if (pageV2) {
        htmlRecord[pageV2.name] = await generateHTMLFromPageV2(pageV2, params);
      }
    } else {
      const pageV2s = await getPageV2ByMessageId(messageId);
      for (const pageV2 of pageV2s) {
        if (pageV2.name === pageName) {
          htmlRecord[pageV2.name] = await generateHTMLFromPageV2(pageV2, params);
        }
      }
    }

    if (Object.keys(htmlRecord).length > 0) {
      return htmlRecord;
    }

    logger.debug(`未找到 PageV2，回退到旧版 Page: messageId=${messageId}, pageName=${pageName}`);

    const page = await getPageByMessageId(messageId);
    if (!page) {
      throw new Error(`找不到消息 ${messageId} 对应的 Page 或 PageV2 记录`);
    }
    const pages = page.pages;
    if (!pages) {
      throw new Error(`找不到页面 ${pageName}`);
    }

    const pageArrays = JSON.parse(pages.toString()) as Page[];
    if (pageName) {
      const targetPage = pageArrays.find((p) => p.name === pageName);
      if (!targetPage) {
        throw new Error(`找不到页面 ${pageName}`);
      }
      htmlRecord[targetPage.name] = await generateHTMLFromPageV1(targetPage, params);
    } else {
      pageArrays.forEach(async (page) => {
        htmlRecord[page.name] = await generateHTMLFromPageV1(page, params);
      });
    }

    return htmlRecord;
  } catch (error) {
    logger.error('生成 HTML 文件失败:', error);
    throw error;
  }
}

/**
 * Convert ExportedFiles to string record format
 * @param files exported file mapping
 * @returns string record format
 */
export function convertFilesToStringRecord(files: ExportedFiles): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [filename, content] of Object.entries(files)) {
    if (Buffer.isBuffer(content)) {
      result[filename] = content.toString('binary');
    } else if (typeof content === 'string') {
      result[filename] = content;
    } else {
      logger.warn(`未知的内容类型: ${filename}`);
    }
  }

  return result;
}

/**
 * Add static asset files (tailwindcss.js and iconify-icon.min.js)
 * @param files file mapping
 */
async function addStaticAssets(files: ExportedFiles): Promise<void> {
  try {
    const tailwindPath = path.join(process.cwd(), 'public', 'tailwindcss.js');
    if (fs.existsSync(tailwindPath)) {
      const tailwindContent = fs.readFileSync(tailwindPath, 'utf-8');
      files['tailwindcss.js'] = tailwindContent;
    }

    // read iconify-icon.min.js
    const iconifyPath = path.join(process.cwd(), 'public', 'iconify-icon.min.js');
    if (fs.existsSync(iconifyPath)) {
      const iconifyContent = fs.readFileSync(iconifyPath, 'utf-8');
      files['iconify-icon.min.js'] = iconifyContent;
    }
  } catch (error) {
    logger.error('添加静态资源失败:', error);
  }
}

/**
 * Generate files corresponding to the message and page name, including HTML files and resource files
 *
 * If pageName is empty, generate all pages.
 * @param params generate parameters
 * @returns exported file mapping
 */
export async function generateFilesFromPagesV2(pages: PageV2[], params: GenerateHTMLParams): Promise<ExportedFiles> {
  const { inner = false } = params;
  const files: ExportedFiles = {};
  for (const page of pages) {
    const html = await generateHTMLFromPageV2(page, params);
    files[`${page.name}.html`] = html;
    if (!inner) {
      const assets = await getAssetsByPageId(page.id);
      for (const asset of assets) {
        try {
          const storagePath = asset.storagePath;
          const content = await readFileContent(storagePath);
          const assetPath = `assets/${asset.filename}`;
          files[assetPath] = content;
          logger.debug(`添加资源文件: ${assetPath}`);
        } catch (error) {
          logger.error(`读取资源文件失败: ${asset.filename}`, error);
        }
      }
    }
  }

  // if external export, add static assets files
  if (!inner) {
    await addStaticAssets(files);
  }

  return files;
}

export async function generateFilesFromPagesV1(pages: Page[], params: GenerateHTMLParams): Promise<ExportedFiles> {
  const { inner = false } = params;
  const files: ExportedFiles = {};
  for (const page of pages) {
    const html = await generateHTMLFromPageV1(page, params);
    files[`${page.name}.html`] = html;
    if (!inner) {
      // TODO: collect and read resource files
    }
  }
  return files;
}

/**
 * Generate deployment files (compatible with old interface)
 * Generate files corresponding to the message and page name, including HTML files and resource files
 * If pageName is empty, generate all pages.
 *
 * @param params generate parameters
 * @returns exported file mapping {filename: content}
 */
export async function generateDeploymentFiles(params: GenerateHTMLParams): Promise<ExportedFiles> {
  const { messageId, pageName } = params;

  if (pageName) {
    const pageV2 = await getPageV2ByMessageIdAndName(messageId, pageName);
    if (pageV2) {
      return await generateFilesFromPagesV2([pageV2], params);
    }
  } else {
    const pageV2s = await getPageV2ByMessageId(messageId);
    if (pageV2s.length > 0) {
      return await generateFilesFromPagesV2(pageV2s, params);
    }
  }

  const pageV1 = await getPageByMessageId(messageId);
  if (!pageV1) {
    throw new Error(`找不到消息 ${messageId} 对应的 Page 或 PageV2 记录`);
  }

  const pages = pageV1.pages;
  if (!pages) {
    throw new Error(`找不到消息 ${messageId} 对应的 Page 或 PageV2 记录`);
  }
  const pageArrays = JSON.parse(pages.toString()) as Page[];
  if (pageArrays.length === 0) {
    throw new Error(`找不到消息 ${messageId} 对应的 Page 或 PageV2 记录`);
  }

  if (pageName) {
    const targetPage = pageArrays.find((p) => p.name === pageName);
    if (!targetPage) {
      throw new Error(`找不到页面 ${pageName}`);
    }
    return await generateFilesFromPagesV1([targetPage], params);
  } else {
    return await generateFilesFromPagesV1(pageArrays, params);
  }
}

function createProjectHead(page: Page, pathMode: 'relative' | 'absolute' = 'relative', attachBody?: string): Document {
  const basePath = pathMode === 'relative' ? './' : '/';
  const doc = document.implementation.createHTMLDocument('');
  const head = doc.head;

  const meta = doc.createElement('meta');
  meta.setAttribute('charset', 'UTF-8');
  head.appendChild(meta);

  const viewport = doc.createElement('meta');
  viewport.setAttribute('name', 'viewport');
  viewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
  head.appendChild(viewport);

  const title = doc.createElement('title');
  title.textContent = page.title || 'UPage Generated Page';
  head.appendChild(title);

  const tailwindScript = doc.createElement('script');
  tailwindScript.setAttribute('src', `${basePath}tailwindcss.js`);
  head.appendChild(tailwindScript);

  const iconifyScript = doc.createElement('script');
  iconifyScript.setAttribute('src', `${basePath}iconify-icon.min.js`);
  head.appendChild(iconifyScript);

  if (attachBody) {
    const body = doc.body;
    body.insertAdjacentHTML('beforeend', attachBody);
  }

  return doc;
}
