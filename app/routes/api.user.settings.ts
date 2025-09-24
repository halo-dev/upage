import { type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/lib/.server/auth';
import {
  deleteUserSetting,
  deleteUserSettings,
  getUserSetting,
  getUserSettings,
  setUserSetting,
} from '~/lib/.server/userSettings';
import { errorResponse, successResponse } from '~/utils/api-response';
import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('api.user.settings');

export async function loader({ request }: LoaderFunctionArgs) {
  // 验证用户权限
  const authResult = await requireAuth(request, { isApi: true });
  if (authResult instanceof Response) {
    return authResult;
  }

  // 确保用户信息存在
  if (!authResult.userInfo) {
    return errorResponse(401, '无法获取用户信息');
  }

  const userId = authResult.userInfo.sub;
  if (!userId) {
    return errorResponse(401, '无效的用户ID');
  }

  try {
    const url = new URL(request.url);
    const category = url.searchParams.get('category') || undefined;
    const key = url.searchParams.get('key') || undefined;
    const includeSecrets = url.searchParams.get('includeSecrets') === 'true';

    // 如果同时提供了category和key，则获取单个设置
    if (category && key) {
      const setting = await getUserSetting(userId, category, key);
      if (!setting) {
        return errorResponse(404, '未找到指定的设置');
      }

      // 如果是敏感信息且未明确要求包含敏感信息，则不返回值
      if (setting.isSecret && !includeSecrets) {
        return successResponse({
          ...setting,
          value: '[REDACTED]',
        });
      }

      return successResponse(setting);
    }

    // 否则获取所有符合条件的设置
    const settings = await getUserSettings({
      userId,
      category,
      key,
      includeSecrets,
    });

    return successResponse(settings);
  } catch (error) {
    logger.error('获取用户设置失败:', error);
    return errorResponse(500, '获取用户设置失败');
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const authResult = await requireAuth(request, { isApi: true });
  if (authResult instanceof Response) {
    return authResult;
  }

  // 确保用户信息存在
  if (!authResult.userInfo) {
    return errorResponse(401, '无法获取用户信息');
  }

  const userId = authResult.userInfo.sub;
  if (!userId) {
    return errorResponse(401, '无效的用户ID');
  }

  try {
    if (request.method === 'POST') {
      const { category, key, value, isSecret } = await request.json();

      if (!category || !key || value === undefined) {
        return errorResponse(400, '缺少必要参数: category, key, value');
      }

      const setting = await setUserSetting({
        userId,
        category,
        key,
        value,
        isSecret: isSecret || false,
      });

      return successResponse(setting, '设置保存成功');
    }
    if (request.method === 'DELETE') {
      const { category, key } = await request.json();

      if (!category) {
        return errorResponse(400, '删除设置时必须提供category参数');
      }

      if (key) {
        await deleteUserSetting(userId, category, key);
        return successResponse(null, '设置删除成功');
      }
      const count = await deleteUserSettings(userId, category);
      return successResponse({ count }, `成功删除 ${count} 条设置`);
    }

    return errorResponse(405, '不支持的请求方法');
  } catch (error) {
    logger.error('处理用户设置失败:', error);
    return errorResponse(500, '处理用户设置失败');
  }
}
