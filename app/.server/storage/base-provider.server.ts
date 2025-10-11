import type { StorageFile, StorageProvider, StorageUploadOptions } from './types';

/**
 * 存储提供者类
 * 提供通用的文件存储功能实现
 */
export abstract class BaseStorageProvider implements StorageProvider {
  /**
   * 上传文件
   * @param options 上传选项
   */
  abstract uploadFile(options: StorageUploadOptions): Promise<StorageFile>;

  /**
   * 获取文件
   * @param userId 用户ID
   * @param filename 文件名
   */
  abstract getFile(userId: string, filename: string): Promise<StorageFile | null>;

  /**
   * 删除文件
   * @param userId 用户ID
   * @param filename 文件名
   */
  abstract deleteFile(userId: string, filename: string): Promise<boolean>;

  /**
   * 检查文件是否存在
   * @param userId 用户ID
   * @param filename 文件名
   */
  abstract fileExists(userId: string, filename: string): Promise<boolean>;

  /**
   * 生成文件访问URL
   * @param userId 用户ID
   * @param filename 文件名
   * @returns 文件访问URL
   */
  getFileUrl(userId: string, filename: string): string {
    return `/assets/${userId}/${filename}`;
  }

  /**
   * 生成唯一文件名
   * @param originalFilename 原始文件名
   * @returns 唯一文件名
   */
  protected generateUniqueFilename(originalFilename: string): string {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const extension = this.getFileExtension(originalFilename);
    return `${timestamp}-${randomStr}${extension}`;
  }

  /**
   * 获取文件扩展名
   * @param filename 文件名
   * @returns 文件扩展名（包含点号）
   */
  protected getFileExtension(filename: string): string {
    const lastDotIndex = filename.lastIndexOf('.');
    return lastDotIndex !== -1 ? filename.substring(lastDotIndex) : '';
  }
}
