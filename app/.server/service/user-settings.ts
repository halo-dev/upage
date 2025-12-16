import { prisma } from '~/.server/service/prisma';
import { createScopedLogger } from '~/.server/utils/logger';

const logger = createScopedLogger('userSettings.server');

/**
 * 用户设置创建/更新参数接口
 */
export interface UserSettingParams {
  userId: string;
  category: string;
  key: string;
  value: string;
  isSecret?: boolean;
}

/**
 * 用户设置查询参数接口
 */
export interface UserSettingQueryParams {
  userId: string;
  category?: string;
  key?: string;
  includeSecrets?: boolean;
}

/**
 * 创建或更新用户设置
 *
 * @param params 用户设置参数
 * @returns 创建或更新的用户设置
 */
export async function setUserSetting(params: UserSettingParams) {
  const { userId, category, key, value, isSecret = false } = params;

  try {
    const setting = await prisma.userSetting.upsert({
      where: {
        userId_category_key: {
          userId,
          category,
          key,
        },
      },
      update: {
        value,
        isSecret,
      },
      create: {
        userId,
        category,
        key,
        value,
        isSecret,
      },
    });

    logger.info(`[UserSetting] 设置用户 ${userId} 的 ${category}.${key} 成功`);
    return setting;
  } catch (error) {
    logger.error(`[UserSetting] 设置用户 ${userId} 的 ${category}.${key} 失败:`, error);
    throw error;
  }
}

/**
 * 获取用户设置
 * @param params 查询参数
 * @returns 用户设置列表
 */
export async function getUserSettings(params: UserSettingQueryParams) {
  const { userId, category, key, includeSecrets = false } = params;

  try {
    const where: any = { userId };

    if (category) {
      where.category = category;
    }

    if (key) {
      where.key = key;
    }

    // 如果不包含敏感信息，则过滤掉敏感设置
    if (!includeSecrets) {
      where.isSecret = false;
    }

    const settings = await prisma.userSetting.findMany({
      where,
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    return settings;
  } catch (error) {
    logger.error(`[UserSetting] 获取用户 ${userId} 的设置失败:`, error);
    throw error;
  }
}

/**
 * 获取单个用户设置
 * @param userId 用户ID
 * @param category 设置类别
 * @param key 设置键名
 * @returns 用户设置，如果不存在则返回null
 */
export async function getUserSetting(userId: string, category: string, key: string) {
  try {
    const setting = await prisma.userSetting.findUnique({
      where: {
        userId_category_key: {
          userId,
          category,
          key,
        },
      },
    });

    return setting;
  } catch (error) {
    logger.error(`[UserSetting] 获取用户 ${userId} 的 ${category}.${key} 失败:`, error);
    throw error;
  }
}

/**
 * 删除用户设置
 * @param userId 用户ID
 * @param category 设置类别
 * @param key 设置键名
 * @returns 删除的用户设置
 */
export async function deleteUserSetting(userId: string, category: string, key: string) {
  try {
    const setting = await prisma.userSetting.delete({
      where: {
        userId_category_key: {
          userId,
          category,
          key,
        },
      },
    });

    logger.info(`[UserSetting] 删除用户 ${userId} 的 ${category}.${key} 成功`);
    return setting;
  } catch (error) {
    logger.error(`[UserSetting] 删除用户 ${userId} 的 ${category}.${key} 失败:`, error);
    throw error;
  }
}

/**
 * 删除用户的所有设置
 * @param userId 用户ID
 * @param category 可选的设置类别，如果提供则只删除该类别的设置
 * @returns 删除的设置数量
 */
export async function deleteUserSettings(userId: string, category?: string) {
  try {
    const where: any = { userId };

    if (category) {
      where.category = category;
    }

    const result = await prisma.userSetting.deleteMany({
      where,
    });

    logger.info(
      `[UserSetting] 删除用户 ${userId} 的${category ? ` ${category}` : '所有'}设置成功，共 ${result.count} 条`,
    );
    return result.count;
  } catch (error) {
    logger.error(`[UserSetting] 删除用户 ${userId} 的${category ? ` ${category}` : '所有'}设置失败:`, error);
    throw error;
  }
}
