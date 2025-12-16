import fs from 'fs';
import path from 'path';
import { createScopedLogger } from '~/.server/utils/logger';
import { generateUniqueFilename } from '~/utils/file-type';
import { getContentType } from '~/utils/file-utils';
import { BaseStorageProvider } from './base-provider.server';
import type { StorageFile, StorageUploadOptions } from './types';

const logger = createScopedLogger('storage.local-provider');

/**
 * 本地文件存储提供者
 * 将文件存储在本地文件系统中
 */
export class LocalStorageProvider extends BaseStorageProvider {
  private _baseDir: string;

  constructor(baseDir?: string) {
    super();
    // 默认使用项目根目录下的 public/uploads 目录
    this._baseDir = baseDir || path.join(process.cwd(), 'public', 'uploads');
    this.ensureDirectoryExists(this.baseDir);
    logger.debug('本地存储初始化', JSON.stringify({ baseDir: this.baseDir }));
  }

  get baseDir(): string {
    return this._baseDir;
  }

  /**
   * 上传文件
   * @param options 上传选项
   * @returns 存储文件信息
   */
  async uploadFile(options: StorageUploadOptions): Promise<StorageFile> {
    const { contentType, filename, dirs, data, keepOriginalFilename = false } = options;
    // 生成唯一文件名
    let uniqueFilename = filename;
    if (!keepOriginalFilename) {
      uniqueFilename = generateUniqueFilename(filename);
    }
    let filePath = '';
    if (dirs) {
      const userDir = path.join(this.baseDir, dirs);
      this.ensureDirectoryExists(userDir);
      filePath = path.join(userDir, uniqueFilename);
    } else {
      filePath = path.join(this.baseDir, uniqueFilename);
    }

    try {
      const fileDir = path.dirname(filePath);
      this.ensureDirectoryExists(fileDir);

      if (typeof data === 'string') {
        if (data.startsWith('data:')) {
          const base64Data = data.split(',')[1];
          await fs.promises.writeFile(filePath, Buffer.from(base64Data, 'base64'));
        } else {
          await fs.promises.writeFile(filePath, data);
        }
      } else if (Buffer.isBuffer(data)) {
        await fs.promises.writeFile(filePath, data);
      } else {
        const arrayBuffer = await data.arrayBuffer();
        await fs.promises.writeFile(filePath, Buffer.from(arrayBuffer));
      }

      // 获取文件大小
      const stats = await fs.promises.stat(filePath);

      logger.debug('文件上传成功', { dirs, filename: uniqueFilename, size: stats.size });

      return {
        filename: uniqueFilename,
        contentType,
        size: stats.size,
        path: filePath,
        metadata: options.metadata,
      };
    } catch (error) {
      logger.error('文件上传失败', { dirs, filename, error });
      throw new Error(`文件上传失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取文件
   * @param filepath 文件路径
   * @returns 存储文件信息，如果不存在则返回null
   */
  async getFile(filepath: string): Promise<StorageFile | null> {
    const filePath = path.join(this.baseDir, filepath);

    try {
      const stats = await fs.promises.stat(filePath);

      if (!stats.isFile()) {
        return null;
      }

      const contentType = getContentType(filepath);

      return {
        filename: filepath,
        contentType,
        size: stats.size,
        path: filePath,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logger.error(`获取文件失败: ${filepath} ${errorMessage}`);
      return null;
    }
  }

  /**
   * 删除文件
   * @param filepath 文件路径
   * @returns 是否删除成功
   */
  async deleteFile(filepath: string): Promise<boolean> {
    const filePath = path.join(this.baseDir, filepath);

    try {
      await fs.promises.unlink(filePath);
      logger.debug('文件删除成功', { filepath });
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logger.error(`删除文件失败: ${filepath} ${errorMessage}`);
      return false;
    }
  }

  /**
   * 检查文件是否存在
   * @param filepath 文件路径
   * @returns 文件是否存在
   */
  async fileExists(filepath: string): Promise<boolean> {
    const filePath = path.join(this.baseDir, filepath);

    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 根据文件路径获取文件内容
   * @param filepath 文件路径
   * @returns 文件内容
   */
  async getFileContent(filepath: string): Promise<Buffer> {
    const filePath = path.join(this.baseDir, filepath);
    if (!(await this.fileExists(filepath))) {
      throw new Error(`文件不存在: ${filepath}`);
    }
    return await fs.promises.readFile(filePath);
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
}
