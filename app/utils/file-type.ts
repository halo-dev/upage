/**
 * 判断文件是否为图片
 */
export function isImageFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();

  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico'];

  return imageExtensions.includes(ext || '');
}

/**
 * 判断文件是否为视频
 */
export function isVideoFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();

  const videoExtensions = ['mp4', 'webm', 'ogg', 'mov', 'avi'];

  return videoExtensions.includes(ext || '');
}

/**
 * 判断文件是否为音频
 */
export function isAudioFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();

  const audioExtensions = ['mp3', 'wav', 'ogg', 'aac', 'm4a'];

  return audioExtensions.includes(ext || '');
}

/**
 * 判断 MIME 类型是否为文本
 */
export function isTextMimeType(mimeType: string): boolean {
  return (
    mimeType.startsWith('text/') ||
    mimeType === 'application/json' ||
    mimeType === 'application/xml' ||
    mimeType === 'image/svg+xml'
  );
}

/**
 * 生成唯一文件名
 * @param originalFilename 原始文件名
 * @returns 唯一文件名
 */
export function generateUniqueFilename(originalFilename: string): string {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  const extension = getFileExtension(originalFilename);
  return `${timestamp}-${randomStr}${extension}`;
}

/**
 * 获取文件扩展名
 * @param filename 文件名
 * @returns 文件扩展名（包含点号）
 */
export function getFileExtension(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.');
  return lastDotIndex !== -1 ? filename.substring(lastDotIndex) : '';
}
