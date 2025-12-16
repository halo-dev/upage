import type { StorageFile, StorageProvider, StorageUploadOptions } from './types';

/**
 * 存储提供者类
 * 提供通用的文件存储功能实现
 */
export abstract class BaseStorageProvider implements StorageProvider {
  abstract get baseDir(): string;

  /**
   * 获取文件内容
   * @param filepath 文件路径
   * @returns 文件内容
   */
  abstract getFileContent(filepath: string): Promise<Buffer>;

  /**
   * 上传文件
   * @param options 上传选项
   */
  abstract uploadFile(options: StorageUploadOptions): Promise<StorageFile>;

  /**
   * 获取文件
   * @param filepath 文件路径
   */
  abstract getFile(filepath: string): Promise<StorageFile | null>;

  /**
   * 删除文件
   * @param filepath 文件路径
   */
  abstract deleteFile(filepath: string): Promise<boolean>;

  /**
   * 检查文件是否存在
   * @param filepath 文件路径
   */
  abstract fileExists(filepath: string): Promise<boolean>;

  /**
   * 生成文件访问URL
   * @param filepath 文件路径
   * @returns 文件访问URL
   */
  getFileUrl(filepath: string): string {
    return `/assets/${filepath}`;
  }
}
