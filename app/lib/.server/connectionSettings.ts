import { deleteUserSetting, deleteUserSettings, getUserSetting, setUserSetting } from '~/lib/.server/userSettings';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('connectionSettings.server');

/**
 * 1Panel 连接设置
 */
export const ONEPANEL_SETTINGS = {
  CATEGORY: 'connectivity',
  SERVER_URL_KEY: '1panel_server_url',
  API_KEY_KEY: '1panel_api_key',
};

/**
 * Netlify 连接设置
 */
export const NETLIFY_SETTINGS = {
  CATEGORY: 'connectivity',
  TOKEN_KEY: 'netlify_token',
};

/**
 * Vercel 连接设置
 */
export const VERCEL_SETTINGS = {
  CATEGORY: 'connectivity',
  TOKEN_KEY: 'vercel_token',
};

/**
 * 获取1Panel连接设置
 * @param userId 用户ID
 * @returns 包含serverUrl和apiKey的对象，如果未设置则返回null
 */
export async function get1PanelConnectionSettings(
  userId: string,
): Promise<{ serverUrl: string; apiKey: string } | null> {
  try {
    const serverUrlSetting = await getUserSetting(userId, ONEPANEL_SETTINGS.CATEGORY, ONEPANEL_SETTINGS.SERVER_URL_KEY);
    const apiKeySetting = await getUserSetting(userId, ONEPANEL_SETTINGS.CATEGORY, ONEPANEL_SETTINGS.API_KEY_KEY);

    if (!serverUrlSetting || !apiKeySetting) {
      return null;
    }

    return {
      serverUrl: serverUrlSetting.value,
      apiKey: apiKeySetting.value,
    };
  } catch (error) {
    logger.error(`[1Panel] 获取用户 ${userId} 的连接设置失败:`, error);
    return null;
  }
}

/**
 * 保存1Panel连接设置
 * @param userId 用户ID
 * @param serverUrl 服务器URL
 * @param apiKey API密钥
 */
export async function save1PanelConnectionSettings(userId: string, serverUrl: string, apiKey: string): Promise<void> {
  try {
    await setUserSetting({
      userId,
      category: ONEPANEL_SETTINGS.CATEGORY,
      key: ONEPANEL_SETTINGS.SERVER_URL_KEY,
      value: serverUrl,
    });

    await setUserSetting({
      userId,
      category: ONEPANEL_SETTINGS.CATEGORY,
      key: ONEPANEL_SETTINGS.API_KEY_KEY,
      value: apiKey,
      isSecret: true,
    });

    logger.info(`[1Panel] 保存用户 ${userId} 的连接设置成功`);
  } catch (error) {
    logger.error(`[1Panel] 保存用户 ${userId} 的连接设置失败:`, error);
    throw error;
  }
}

/**
 * 删除1Panel连接设置
 * @param userId 用户ID
 */
export async function delete1PanelConnectionSettings(userId: string): Promise<void> {
  try {
    await deleteUserSetting(userId, ONEPANEL_SETTINGS.CATEGORY, ONEPANEL_SETTINGS.SERVER_URL_KEY);
    await deleteUserSetting(userId, ONEPANEL_SETTINGS.CATEGORY, ONEPANEL_SETTINGS.API_KEY_KEY);

    logger.info(`[1Panel] 删除用户 ${userId} 的连接设置成功`);
  } catch (error) {
    logger.error(`[1Panel] 删除用户 ${userId} 的连接设置失败:`, error);
    throw error;
  }
}

/**
 * 获取Netlify连接设置
 * @param userId 用户ID
 * @returns 包含token的对象，如果未设置则返回null
 */
export async function getNetlifyConnectionSettings(userId: string): Promise<{ token: string } | null> {
  try {
    const tokenSetting = await getUserSetting(userId, NETLIFY_SETTINGS.CATEGORY, NETLIFY_SETTINGS.TOKEN_KEY);

    if (!tokenSetting) {
      return null;
    }

    return {
      token: tokenSetting.value,
    };
  } catch (error) {
    logger.error(`[Netlify] 获取用户 ${userId} 的连接设置失败:`, error);
    return null;
  }
}

/**
 * 保存Netlify连接设置
 * @param userId 用户ID
 * @param token 访问令牌
 */
export async function saveNetlifyConnectionSettings(userId: string, token: string): Promise<void> {
  try {
    await setUserSetting({
      userId,
      category: NETLIFY_SETTINGS.CATEGORY,
      key: NETLIFY_SETTINGS.TOKEN_KEY,
      value: token,
      isSecret: true,
    });

    logger.info(`[Netlify] 保存用户 ${userId} 的连接设置成功`);
  } catch (error) {
    logger.error(`[Netlify] 保存用户 ${userId} 的连接设置失败:`, error);
    throw error;
  }
}

/**
 * 删除Netlify连接设置
 * @param userId 用户ID
 */
export async function deleteNetlifyConnectionSettings(userId: string): Promise<void> {
  try {
    await deleteUserSetting(userId, NETLIFY_SETTINGS.CATEGORY, NETLIFY_SETTINGS.TOKEN_KEY);

    logger.info(`[Netlify] 删除用户 ${userId} 的连接设置成功`);
  } catch (error) {
    logger.error(`[Netlify] 删除用户 ${userId} 的连接设置失败:`, error);
    throw error;
  }
}

/**
 * 获取Vercel连接设置
 * @param userId 用户ID
 * @returns 包含token的对象，如果未设置则返回null
 */
export async function getVercelConnectionSettings(userId: string): Promise<{ token: string } | null> {
  try {
    const tokenSetting = await getUserSetting(userId, VERCEL_SETTINGS.CATEGORY, VERCEL_SETTINGS.TOKEN_KEY);

    if (!tokenSetting) {
      return null;
    }

    return {
      token: tokenSetting.value,
    };
  } catch (error) {
    logger.error(`[Vercel] 获取用户 ${userId} 的连接设置失败:`, error);
    return null;
  }
}

/**
 * 保存Vercel连接设置
 * @param userId 用户ID
 * @param token 访问令牌
 */
export async function saveVercelConnectionSettings(userId: string, token: string): Promise<void> {
  try {
    await setUserSetting({
      userId,
      category: VERCEL_SETTINGS.CATEGORY,
      key: VERCEL_SETTINGS.TOKEN_KEY,
      value: token,
      isSecret: true,
    });

    logger.info(`[Vercel] 保存用户 ${userId} 的连接设置成功`);
  } catch (error) {
    logger.error(`[Vercel] 保存用户 ${userId} 的连接设置失败:`, error);
    throw error;
  }
}

/**
 * 删除Vercel连接设置
 * @param userId 用户ID
 */
export async function deleteVercelConnectionSettings(userId: string): Promise<void> {
  try {
    await deleteUserSetting(userId, VERCEL_SETTINGS.CATEGORY, VERCEL_SETTINGS.TOKEN_KEY);

    logger.info(`[Vercel] 删除用户 ${userId} 的连接设置成功`);
  } catch (error) {
    logger.error(`[Vercel] 删除用户 ${userId} 的连接设置失败:`, error);
    throw error;
  }
}

/**
 * 删除所有连接设置
 * @param userId 用户ID
 */
export async function deleteAllConnectionSettings(userId: string): Promise<void> {
  try {
    // 使用 deleteUserSettings 删除 'connectivity' 类别下的所有设置
    await deleteUserSettings(userId, 'connectivity');

    logger.info(`[连接设置] 删除用户 ${userId} 的所有连接设置成功`);
  } catch (error) {
    logger.error(`[连接设置] 删除用户 ${userId} 的所有连接设置失败:`, error);
    throw error;
  }
}
