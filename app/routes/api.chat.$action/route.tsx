import { type ActionFunctionArgs, type LoaderFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/.server/service/auth';
import { errorResponse } from '~/.server/utils/api-response';
import { handleDeleteAction } from './delete.server';
import { handleForkAction } from './fork.server';
import { handleListLoader } from './list.server';
import { handleUpdateAction } from './update.server';

/**
 * 动态路由处理聊天相关操作
 * 支持的操作:
 * - list: 获取聊天列表（GET请求）
 * - delete: 删除聊天
 * - update: 更新聊天
 * - fork: 复制聊天
 */

/**
 * 处理GET请求，用于获取数据
 */
export async function loader(args: LoaderFunctionArgs) {
  const authResult = await requireAuth(args.request, { isApi: true });

  if (authResult instanceof Response) {
    return authResult;
  }

  const userId = authResult.userInfo?.sub;
  if (!userId) {
    return errorResponse(401, '用户未登录');
  }

  // 获取操作类型
  const { action } = args.params;

  // 根据操作类型分发到不同的处理函数
  switch (action) {
    case 'list':
      return handleListLoader({ ...args, userId });
    default:
      return errorResponse(400, `不支持的操作: ${action}`);
  }
}

/**
 * 处理非GET请求，用于修改数据
 */
export async function action(args: ActionFunctionArgs) {
  const authResult = await requireAuth(args.request, { isApi: true });

  if (authResult instanceof Response) {
    return authResult;
  }

  const userId = authResult.userInfo?.sub;
  if (!userId) {
    return errorResponse(401, '用户未登录');
  }

  // 获取操作类型
  const { action } = args.params;

  // 根据操作类型分发到不同的处理函数
  switch (action) {
    case 'delete':
      return handleDeleteAction({ ...args, userId });
    case 'update':
      return handleUpdateAction({ ...args, userId });
    case 'fork':
      return handleForkAction({ ...args, userId });
    default:
      return errorResponse(400, `不支持的操作: ${action}`);
  }
}
