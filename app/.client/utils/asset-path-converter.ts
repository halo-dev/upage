import type { PageAssetData, PageHeadLink, PageHeadMeta, PageHeadScript, PageHeadStyle } from '~/types/pages';
import { normalizeAssetPath } from '~/utils/path';

/**
 * Replace relative paths with absolute URLs in HTML content
 *
 * @param html original HTML content
 * @param assets PageAsset array, containing filename and url mapping
 * @returns replaced HTML content
 */
export function replaceRelativePathsWithUrls(html: string, assets: PageAssetData[]): string {
  if (!html || !assets || assets.length === 0) {
    return html;
  }

  let updatedHtml = html;

  // create replacement rules for each asset
  for (const asset of assets) {
    const { filename, url } = asset;

    const normalizedFilename = normalizeAssetPath(filename);
    const pathVariants = [filename, `./${filename}`, `/${filename}`, `../${filename}`, normalizedFilename];

    for (const pathVariant of pathVariants) {
      const escapedPath = pathVariant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      const doubleQuotePattern = new RegExp(`(\\s(?:src|href|data-src|data-href))=["']${escapedPath}["']`, 'gi');
      updatedHtml = updatedHtml.replace(doubleQuotePattern, `$1="${url}"`);

      const urlPattern1 = new RegExp(`url\\(["']${escapedPath}["']\\)`, 'gi');
      const urlPattern2 = new RegExp(`url\\(${escapedPath}\\)`, 'gi');
      updatedHtml = updatedHtml.replace(urlPattern1, `url("${url}")`);
      updatedHtml = updatedHtml.replace(urlPattern2, `url("${url}")`);
    }
  }

  return updatedHtml;
}

/**
 * Replace absolute URLs with relative paths in HTML content
 *
 * @param html original HTML content
 * @param assets PageAsset array, containing filename and url mapping
 * @returns replaced HTML content
 */
export function replaceUrlsWithRelativePaths(html: string, assets: PageAssetData[]): string {
  if (!html || !assets || assets.length === 0) {
    return html;
  }

  let updatedHtml = html;

  for (const asset of assets) {
    const { filename, url } = asset;

    const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const attrPattern = new RegExp(`(\\s(?:src|href|data-src|data-href))=["']${escapedUrl}["']`, 'gi');
    updatedHtml = updatedHtml.replace(attrPattern, `$1="${filename}"`);

    const urlPattern1 = new RegExp(`url\\(["']${escapedUrl}["']\\)`, 'gi');
    const urlPattern2 = new RegExp(`url\\(${escapedUrl}\\)`, 'gi');
    updatedHtml = updatedHtml.replace(urlPattern1, `url("${filename}")`);
    updatedHtml = updatedHtml.replace(urlPattern2, `url("${filename}")`);
  }

  return updatedHtml;
}

/**
 * Process paths in headLinks
 */
function convertHeadLinks(
  links: PageHeadLink[] | undefined,
  assets: PageAssetData[],
  direction: 'toUrl' | 'toRelative',
): PageHeadLink[] | undefined {
  if (!links || links.length === 0) {
    return links;
  }

  return links.map((link) => {
    if (!link.href) {
      return link;
    }

    const matchedAsset = assets.find((asset) => {
      const normalizedFilename = normalizeAssetPath(asset.filename);
      const normalizedHref = normalizeAssetPath(link.href);
      return normalizedHref === normalizedFilename || normalizedHref.endsWith(`/${normalizedFilename}`);
    });

    if (!matchedAsset) {
      return link;
    }

    return {
      ...link,
      href: direction === 'toUrl' ? matchedAsset.url : matchedAsset.filename,
    };
  });
}

/**
 * Process paths in headScripts
 */
function convertHeadScripts(
  scripts: PageHeadScript[] | undefined,
  assets: PageAssetData[],
  direction: 'toUrl' | 'toRelative',
): PageHeadScript[] | undefined {
  if (!scripts || scripts.length === 0) {
    return scripts;
  }

  return scripts.map((script) => {
    if (!script.src) {
      return script;
    }

    const matchedAsset = assets.find((asset) => {
      const normalizedFilename = normalizeAssetPath(asset.filename);
      const normalizedSrc = normalizeAssetPath(script.src!);
      return normalizedSrc === normalizedFilename || normalizedSrc.endsWith(`/${normalizedFilename}`);
    });

    if (!matchedAsset) {
      return script;
    }

    return {
      ...script,
      src: direction === 'toUrl' ? matchedAsset.url : matchedAsset.filename,
    };
  });
}

/**
 * Process CSS url() in headStyles
 */
function convertHeadStyles(
  styles: PageHeadStyle[] | undefined,
  assets: PageAssetData[],
  direction: 'toUrl' | 'toRelative',
): PageHeadStyle[] | undefined {
  if (!styles || styles.length === 0) {
    return styles;
  }

  return styles.map((style) => {
    if (!style.content) {
      return style;
    }

    const convertedContent =
      direction === 'toUrl'
        ? replaceRelativePathsWithUrls(style.content, assets)
        : replaceUrlsWithRelativePaths(style.content, assets);

    return {
      ...style,
      content: convertedContent,
    };
  });
}

/**
 * Process resource paths in headMeta (e.g. og:image)
 */
function convertHeadMeta(
  meta: PageHeadMeta[] | undefined,
  assets: PageAssetData[],
  direction: 'toUrl' | 'toRelative',
): PageHeadMeta[] | undefined {
  if (!meta || meta.length === 0) {
    return meta;
  }

  return meta.map((metaTag) => {
    if (!metaTag.content) {
      return metaTag;
    }

    const matchedAsset = assets.find((asset) => {
      const normalizedFilename = normalizeAssetPath(asset.filename);
      const normalizedContent = normalizeAssetPath(metaTag.content || '');
      return normalizedContent === normalizedFilename || normalizedContent.endsWith(`/${normalizedFilename}`);
    });

    if (!matchedAsset) {
      return metaTag;
    }

    return {
      ...metaTag,
      content: direction === 'toUrl' ? matchedAsset.url : matchedAsset.filename,
    };
  });
}

/**
 * Batch process path replacements for multiple pages (including content and all head fields)
 *
 * @param pages page array (containing content, head fields and assets)
 * @param direction conversion direction: 'toUrl' or 'toRelative'
 * @returns processed page array
 */
export function batchConvertAssetPaths<
  T extends {
    content?: string;
    assets?: PageAssetData[];
    headLinks?: PageHeadLink[];
    headScripts?: PageHeadScript[];
    headStyles?: PageHeadStyle[];
    headMeta?: PageHeadMeta[];
    headRaw?: string;
  },
>(pages: T[], direction: 'toUrl' | 'toRelative'): T[] {
  return pages.map((page) => {
    if (!page.assets || page.assets.length === 0) {
      return page;
    }

    const result: T = { ...page };

    if (page.content) {
      result.content =
        direction === 'toUrl'
          ? replaceRelativePathsWithUrls(page.content, page.assets)
          : replaceUrlsWithRelativePaths(page.content, page.assets);
    }

    if (page.headLinks) {
      result.headLinks = convertHeadLinks(page.headLinks, page.assets, direction);
    }

    if (page.headScripts) {
      result.headScripts = convertHeadScripts(page.headScripts, page.assets, direction);
    }

    if (page.headStyles) {
      result.headStyles = convertHeadStyles(page.headStyles, page.assets, direction);
    }

    if (page.headMeta) {
      result.headMeta = convertHeadMeta(page.headMeta, page.assets, direction);
    }

    if (page.headRaw) {
      result.headRaw =
        direction === 'toUrl'
          ? replaceRelativePathsWithUrls(page.headRaw, page.assets)
          : replaceUrlsWithRelativePaths(page.headRaw, page.assets);
    }

    return result;
  });
}
