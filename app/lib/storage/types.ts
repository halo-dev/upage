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
  /** 用户ID */
  userId: string;
  /** 内容类型 */
  contentType: string;
  /** 文件名 */
  filename: string;
  /** 文件数据 */
  data: Buffer | Blob | string;
  /** 元数据 */
  metadata?: Record<string, any>;
}

/**
 * 存储提供者接口
 */
export interface StorageProvider {
  /**
   * 上传文件
   * @param options 上传选项
   * @returns 存储文件信息
   */
  uploadFile(options: StorageUploadOptions): Promise<StorageFile>;

  /**
   * 获取文件
   * @param userId 用户ID
   * @param filename 文件名
   * @returns 存储文件信息，如果不存在则返回null
   */
  getFile(userId: string, filename: string): Promise<StorageFile | null>;

  /**
   * 删除文件
   * @param userId 用户ID
   * @param filename 文件名
   * @returns 是否删除成功
   */
  deleteFile(userId: string, filename: string): Promise<boolean>;

  /**
   * 检查文件是否存在
   * @param userId 用户ID
   * @param filename 文件名
   * @returns 文件是否存在
   */
  fileExists(userId: string, filename: string): Promise<boolean>;

  /**
   * 生成文件访问URL
   * @param userId 用户ID
   * @param filename 文件名
   * @returns 文件访问URL
   */
  getFileUrl(userId: string, filename: string): string;
}
