/**
 * 资源文件处理工具
 */

import type { AssetFile, PageAssetData } from '~/types/pages';

/**
 * 判断资源是否应该内联
 * 小于 10KB 的 CSS/JS 文件可以内联
 */
export function shouldInlineAsset(filename: string, fileSize: number): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  const maxInlineSize = 10 * 1024;

  if (fileSize > maxInlineSize) {
    return false;
  }

  return ext === 'css' || ext === 'js';
}

/**
 * 生成资源目录路径
 *
 * @param userId 用户 ID
 * @param messageId 消息 ID
 * @returns 资源目录路径
 */
export function getAssetDirPath(userId: string, messageId: string): string {
  return `assets/${userId}/${messageId}`;
}

/**
 * 生成资源的存储路径
 * @param userId 用户 ID
 * @param messageId 消息 ID
 * @param filename 文件名（可以包含子目录，如 "assets/logo.png"）
 */
export function getAssetStoragePath(userId: string, messageId: string, filename: string): string {
  const normalizedFilename = filename.replace(/^\.?\/?/, '');
  return `${getAssetDirPath(userId, messageId)}/${normalizedFilename}`;
}

/**
 * 生成资源的访问 URL
 * @param storagePath 存储路径
 */
export function getAssetUrl(storagePath: string): string {
  return `/uploads/${storagePath}`;
}

/**
 * 判断是否为文本资源
 *
 * @param filename 文件名
 * @returns 是否为文本资源
 */
export function isTextAsset(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  const textExtensions = ['html', 'htm', 'css', 'js', 'mjs', 'json', 'txt', 'md', 'xml', 'svg', 'yaml', 'yml'];
  return textExtensions.includes(ext || '');
}

/**
 * 更新 HTML 中的资源引用路径
 * @param html 原始 HTML
 * @param assetMap 资源路径映射表（原路径 -> 新 URL）
 */
export function updateAssetReferencesInHTML(html: string, assetMap: Map<string, string>): string {
  let updatedHtml = html;

  for (const [originalPath, newUrl] of assetMap.entries()) {
    const escapedPath = originalPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // 替换各种引用格式
    // 例如: src="path", href="path", src='path', href='path'
    const patterns = [
      new RegExp(`(src|href)=["']${escapedPath}["']`, 'g'),
      new RegExp(`(src|href)=["']\\.\/${escapedPath}["']`, 'g'),
      new RegExp(`(src|href)=["']\\.\\.\/${escapedPath}["']`, 'g'),
    ];

    for (const pattern of patterns) {
      updatedHtml = updatedHtml.replace(pattern, `$1="${newUrl}"`);
    }
  }

  return updatedHtml;
}

/**
 * 从 AssetFile 创建 PageAsset 元信息
 */
export function createPageAsset(assetFile: AssetFile, userId: string, messageId: string): PageAssetData {
  const storagePath = getAssetStoragePath(userId, messageId, assetFile.filename);
  const url = getAssetUrl(storagePath);

  return {
    filename: assetFile.filename,
    storagePath,
    url,
    fileType: assetFile.fileType,
    fileSize: assetFile.fileSize,
  };
}
