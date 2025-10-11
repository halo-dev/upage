import { createScopedLogger } from '~/utils/logger';
import { LocalStorageProvider } from './local-provider.server';
import type { StorageProvider } from './types';

const logger = createScopedLogger('storage');

/**
 * 获取存储目录配置
 * @returns 存储目录路径
 */
const getStorageDir = (): string | undefined => {
  // 如果在Docker环境中运行，使用环境变量中的配置
  if (process.env.RUNNING_IN_DOCKER === 'true' && process.env.STORAGE_DIR) {
    logger.debug('使用Docker环境中的存储目录', JSON.stringify({ dir: process.env.STORAGE_DIR }));
    return process.env.STORAGE_DIR;
  }

  // 使用环境变量中的配置
  if (process.env.STORAGE_DIR) {
    logger.debug('使用环境变量中的存储目录', JSON.stringify({ dir: process.env.STORAGE_DIR }));
    return process.env.STORAGE_DIR;
  }

  // 默认使用项目根目录下的 public/uploads 目录
  logger.debug('使用默认存储目录');
  return undefined;
};

const createStorageProvider = (): StorageProvider => {
  return new LocalStorageProvider(getStorageDir());
};

export const storageProvider = createStorageProvider();

export * from './types';
