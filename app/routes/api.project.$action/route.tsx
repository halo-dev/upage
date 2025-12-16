import { type ActionFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/.server/service/auth';
import { errorResponse } from '~/.server/utils/api-response';
import { createScopedLogger } from '~/.server/utils/logger';
import { exportProject } from './export.server';
import { getProjectFiles } from './files.server';

const logger = createScopedLogger('api.project.$action');

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    // 验证用户身份
    const authResult = await requireAuth(request, { isApi: true });
    if (authResult instanceof Response) {
      return authResult;
    }
    const userId = authResult.userInfo?.sub;
    if (!userId) {
      return errorResponse(401, '用户未登录');
    }

    // 根据 action 路由到不同的处理函数
    const action = params.action;

    switch (action) {
      case 'export':
        return exportProject({ request, userId });
      case 'files':
        return getProjectFiles({ request, userId });
      default:
        return errorResponse(404, `不支持的操作: ${action}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`处理项目请求失败: ${errorMessage}`);
    return errorResponse(500, '请求处理失败');
  }
}
