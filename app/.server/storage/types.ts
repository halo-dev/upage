/**
 * 存储文件信息接口
 */
export interface StorageFile {
  /** 文件名 */
  filename: string;
  /** 内容类型 */
  contentType: string;
  /** 文件大小（字节） */
  size: number;
  /** 文件路径 */
  path: string;
  /** 元数据 */
  metadata?: Record<string, any>;
}

/**
 * 存储上传选项接口
 */
export interface StorageUploadOptions {
  /** 目录 */
  dirs?: string;
  /** 内容类型 */
  contentType: string;
  /** 文件名 */
  filename: string;
  /** 文件数据 */
  data: Buffer | Blob | string;
  /** 元数据 */
  metadata?: Record<string, any>;
  /** 保持原始文件名 */
  keepOriginalFilename?: boolean;
}

/**
 * 存储提供者接口
 */
export interface StorageProvider {
  get baseDir(): string;

  /**
   * 上传文件
   * @param options 上传选项
   * @returns 存储文件信息
   */
  uploadFile(options: StorageUploadOptions): Promise<StorageFile>;

  /**
   * 获取文件
   * @param filepath 文件路径
   * @returns 存储文件信息，如果不存在则返回null
   */
  getFile(filepath: string): Promise<StorageFile | null>;

  /**
   * 删除文件
   * @param filepath 文件路径
   * @returns 是否删除成功
   */
  deleteFile(filepath: string): Promise<boolean>;

  /**
   * 检查文件是否存在
   * @param filepath 文件路径
   * @returns 文件是否存在
   */
  fileExists(filepath: string): Promise<boolean>;

  /**
   * 生成文件访问URL
   * @param filepath 文件路径
   * @returns 文件访问URL
   */
  getFileUrl(filepath: string): string;

  /**
   * 根据文件路径获取文件内容
   */
  getFileContent(filepath: string): Promise<Buffer>;
}
