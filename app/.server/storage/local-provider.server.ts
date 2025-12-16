import fs from 'fs';
import path from 'path';
import { createScopedLogger } from '~/.server/utils/logger';
import { BaseStorageProvider } from './base-provider.server';
import type { StorageFile, StorageUploadOptions } from './types';

const logger = createScopedLogger('storage.local-provider');

/**
 * 本地文件存储提供者
 * 将文件存储在本地文件系统中
 */
export class LocalStorageProvider extends BaseStorageProvider {
  private baseDir: string;

  constructor(baseDir?: string) {
    super();
    // 默认使用项目根目录下的 public/uploads 目录
    this.baseDir = baseDir || path.join(process.cwd(), 'public', 'uploads');
    this.ensureDirectoryExists(this.baseDir);
    logger.debug('本地存储初始化', JSON.stringify({ baseDir: this.baseDir }));
  }

  /**
   * 上传文件
   * @param options 上传选项
   * @returns 存储文件信息
   */
  async uploadFile(options: StorageUploadOptions): Promise<StorageFile> {
    const { userId, contentType, filename, data } = options;

    // 生成唯一文件名
    const uniqueFilename = this.generateUniqueFilename(filename);
    // 确保用户目录存在
    const userDir = path.join(this.baseDir, userId);
    this.ensureDirectoryExists(userDir);

    const filePath = path.join(userDir, uniqueFilename);

    try {
      if (typeof data === 'string') {
        // base64 数据
        if (data.startsWith('data:')) {
          const base64Data = data.split(',')[1];
          await fs.promises.writeFile(filePath, Buffer.from(base64Data, 'base64'));
        } else {
          await fs.promises.writeFile(filePath, data);
        }
      } else if (Buffer.isBuffer(data)) {
        await fs.promises.writeFile(filePath, data);
      } else {
        // 处理 Blob 类型
        const arrayBuffer = await data.arrayBuffer();
        await fs.promises.writeFile(filePath, Buffer.from(arrayBuffer));
      }

      // 获取文件大小
      const stats = await fs.promises.stat(filePath);

      logger.debug('文件上传成功', { userId, filename: uniqueFilename, size: stats.size });

      return {
        filename: uniqueFilename,
        contentType,
        size: stats.size,
        path: filePath,
        metadata: options.metadata,
      };
    } catch (error) {
      logger.error('文件上传失败', { userId, filename, error });
      throw new Error(`文件上传失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取文件
   * @param userId 用户ID
   * @param filename 文件名
   * @returns 存储文件信息，如果不存在则返回null
   */
  async getFile(userId: string, filename: string): Promise<StorageFile | null> {
    const filePath = path.join(this.baseDir, userId, filename);

    try {
      const stats = await fs.promises.stat(filePath);

      if (!stats.isFile()) {
        return null;
      }

      const contentType = this.getContentTypeFromFilename(filename);

      return {
        filename,
        contentType,
        size: stats.size,
        path: filePath,
      };
    } catch (error) {
      logger.error('获取文件失败', { userId, filename, error });
      return null;
    }
  }

  /**
   * 删除文件
   * @param userId 用户ID
   * @param filename 文件名
   * @returns 是否删除成功
   */
  async deleteFile(userId: string, filename: string): Promise<boolean> {
    const filePath = path.join(this.baseDir, userId, filename);

    try {
      await fs.promises.unlink(filePath);
      logger.debug('文件删除成功', { userId, filename });
      return true;
    } catch (error) {
      logger.error('删除文件失败', { userId, filename, error });
      return false;
    }
  }

  /**
   * 检查文件是否存在
   * @param userId 用户ID
   * @param filename 文件名
   * @returns 文件是否存在
   */
  async fileExists(userId: string, filename: string): Promise<boolean> {
    const filePath = path.join(this.baseDir, userId, filename);

    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 确保目录存在
   * @param dir 目录路径
   */
  private ensureDirectoryExists(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * 根据文件名获取内容类型
   * @param filename 文件名
   * @returns 内容类型
   */
  private getContentTypeFromFilename(filename: string): string {
    const extension = this.getFileExtension(filename).toLowerCase();

    // 常见文件类型映射
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.pdf': 'application/pdf',
    };

    return mimeTypes[extension] || 'application/octet-stream';
  }
}
