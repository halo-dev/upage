// Browser-compatible path utilities
import type { ParsedPath } from 'path';
import pathBrowserify from 'path-browserify';

/**
 * A browser-compatible path utility that mimics Node's path module
 * Using path-browserify for consistent behavior in browser environments
 */
export const path = {
  join: (...paths: string[]): string => pathBrowserify.join(...paths),
  dirname: (path: string): string => pathBrowserify.dirname(path),
  basename: (path: string, ext?: string): string => pathBrowserify.basename(path, ext),
  extname: (path: string): string => pathBrowserify.extname(path),
  relative: (from: string, to: string): string => pathBrowserify.relative(from, to),
  isAbsolute: (path: string): boolean => pathBrowserify.isAbsolute(path),
  normalize: (path: string): string => pathBrowserify.normalize(path),
  parse: (path: string): ParsedPath => pathBrowserify.parse(path),
  format: (pathObject: ParsedPath): string => pathBrowserify.format(pathObject),
} as const;

/**
 * Normalize asset path, used for matching
 * Handle ./path, /path, ../path, path等各种情况
 *
 * @param assetPath original path
 * @returns normalized path
 */
export function normalizeAssetPath(assetPath: string): string {
  let normalized = assetPath.replace(/^\.?\/?/, '');
  normalized = normalized.replace(/^(\.\.\/)+/, '');

  return normalized;
}

/**
 * Check if two asset paths match
 * Support full path matching and file name matching
 *
 * @param path1 first path
 * @param path2 second path
 * @returns whether they match
 */
export function isAssetPathMatch(path1: string, path2: string): boolean {
  const normalized1 = normalizeAssetPath(path1);
  const normalized2 = normalizeAssetPath(path2);

  // exact match
  if (normalized1 === normalized2) {
    return true;
  }

  // path ending match (handle js/app.js matching ./js/app.js case)
  if (normalized1.endsWith(`/${normalized2}`) || normalized2.endsWith(`/${normalized1}`)) {
    return true;
  }

  return false;
}
