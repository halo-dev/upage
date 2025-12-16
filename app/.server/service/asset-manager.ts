import { generateId } from 'ai';
import { createPageAsset, getAssetDirPath, shouldInlineAsset } from '~/.server/utils/asset-utils';
import { createScopedLogger } from '~/.server/utils/logger';
import type { ParsedSection } from '~/types/actions';
import type { AssetFile, PageAssetData } from '~/types/pages';
import { storageProvider } from '../storage/index.server';

const logger = createScopedLogger('asset-manager');

export interface UploadAssetsParams {
  userId: string;
  messageId: string;
  assets: Map<string, AssetFile>;
  pageName: string;
}

export interface UploadAssetsResult {
  // uploaded asset metadata
  uploadedAssets: PageAssetData[];
  // inlined resources (will be converted to Section)
  inlinedSections: ParsedSection[];
  // resource path mapping table (original path -> new URL)
  assetMap: Map<string, string>;
  // inlined resource filenames
  inlinedAssetFilenames: string[];
}

/**
 * Process and upload asset files
 */
export async function uploadAssets(params: UploadAssetsParams): Promise<UploadAssetsResult> {
  const { userId, messageId, assets, pageName } = params;

  const uploadedAssets: PageAssetData[] = [];
  const inlinedSections: ParsedSection[] = [];
  const assetMap = new Map<string, string>();
  const inlinedAssetFilenames: string[] = [];

  let inlineSectionIndex = 0;

  for (const [filename, assetFile] of assets.entries()) {
    try {
      // check if asset should be inlined
      if (shouldInlineAsset(filename, assetFile.fileSize)) {
        const inlinedSection = await inlineAsset(assetFile, pageName, inlineSectionIndex);
        if (inlinedSection) {
          inlinedSections.push(inlinedSection);
          inlinedAssetFilenames.push(filename);
          inlineSectionIndex++;
          logger.debug(`Inlined asset: ${filename}`);
        }
      } else {
        // upload asset to storage service
        const uploadedAsset = await uploadSingleAsset(userId, messageId, assetFile);
        uploadedAssets.push(uploadedAsset);
        assetMap.set(filename, uploadedAsset.url);
        logger.debug(`Uploaded asset: ${filename} -> ${uploadedAsset.url}`);
      }
    } catch (error) {
      logger.error(`Failed to process asset ${filename}:`, error);
    }
  }

  logger.info(`Asset processing complete: ${uploadedAssets.length} uploaded, ${inlinedSections.length} inlined`);

  return {
    uploadedAssets,
    inlinedSections,
    assetMap,
    inlinedAssetFilenames,
  };
}

/**
 * Upload single asset file to storage service
 *
 * @param userId user ID
 * @param messageId message ID
 * @param assetFile asset file
 * @returns uploaded asset metadata
 */
async function uploadSingleAsset(userId: string, messageId: string, assetFile: AssetFile): Promise<PageAssetData> {
  let fileData: Buffer | string;
  if (typeof assetFile.content === 'string') {
    fileData = assetFile.content;
  } else {
    fileData = Buffer.from(assetFile.content);
  }

  await storageProvider.uploadFile({
    dirs: getAssetDirPath(userId, messageId),
    filename: assetFile.filename,
    contentType: assetFile.fileType,
    data: fileData,
    keepOriginalFilename: true,
  });

  return createPageAsset(assetFile, userId, messageId);
}

/**
 * Convert small asset files to Section
 * CSS -> <style> Section
 * JS -> <script> Section
 *
 * @param assetFile asset file
 * @param pageName page name
 * @param index index
 * @returns inlined resource Section
 */
async function inlineAsset(assetFile: AssetFile, pageName: string, index: number): Promise<ParsedSection | null> {
  const ext = assetFile.filename.split('.').pop()?.toLowerCase();
  const content = typeof assetFile.content === 'string' ? assetFile.content : '';

  if (!content) {
    logger.warn(`Cannot inline non-text asset: ${assetFile.filename}`);
    return null;
  }

  const rootId = `${pageName}-inlined-${ext}-${generateId()}`;

  if (ext === 'css') {
    return {
      content: `<style id="${rootId}">\n${content}\n</style>`,
      domId: `page-${pageName}`,
      rootDomId: rootId,
      pageName,
      sort: 1000 + index,
      type: 'style',
      actionId: `${pageName}-inlined-style-${index}`,
    };
  }

  if (ext === 'js') {
    return {
      content: `<script id="${rootId}">\n${content}\n</script>`,
      domId: `page-${pageName}`,
      rootDomId: rootId,
      pageName,
      sort: 1000 + index,
      type: 'script',
      actionId: `${pageName}-inlined-script-${index}`,
    };
  }

  logger.warn(`Cannot inline asset with extension: ${ext}`);
  return null;
}

/**
 * Delete all assets associated with the message
 * @param userId user ID
 * @param messageId message ID
 */
export async function deleteMessageAssets(userId: string, messageId: string): Promise<void> {
  try {
    const dirPath = `${getAssetDirPath(userId, messageId)}`;
    // TODO: implement delete directory functionality (if storageProvider supports it)
    logger.info(`Would delete assets in: ${dirPath}`);
  } catch (error) {
    logger.error('Failed to delete message assets:', error);
    throw error;
  }
}
