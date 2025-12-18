import fs from 'fs';
import { type LoaderFunctionArgs } from 'react-router';
import { getUser, requireAuth } from '~/.server/service/auth';
import { storageProvider } from '~/.server/storage/index.server';
import { errorResponse } from '~/.server/utils/api-response';
import { createScopedLogger } from '~/.server/utils/logger';

const logger = createScopedLogger('api.assets.user');

/**
 * 处理文件访问请求, 只有文件所有者可以访问
 *
 * @deprecated 不再使用，仅用于兼容旧版
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

  return assetsUser(args);
}

export async function assetsUser({ request, params }: LoaderFunctionArgs) {
  try {
    const { '*': filepath } = params;

    if (!filepath) {
      return new Response('文件不存在', { status: 404 });
    }

    // 获取 filepath 中的 userId
    const userId = filepath.split('/')[0];
    if (!userId) {
      return new Response('文件不存在', { status: 404 });
    }

    const authResult = await getUser(request);
    const currentUserId = authResult.userInfo?.sub;

    const fileExists = await storageProvider.fileExists(filepath);
    if (!fileExists) {
      logger.debug(`文件不存在: ${filepath}`);
      return new Response('文件不存在', { status: 404 });
    }

    if (currentUserId !== userId) {
      logger.warn(`无权访问文件: ${userId}, ${currentUserId}, ${filepath}`);
      return new Response('无权访问此文件', { status: 403 });
    }

    const file = await storageProvider.getFile(filepath);
    if (!file) {
      logger.debug(`文件不存在: ${userId}, ${filepath}`);
      return new Response('文件不存在', { status: 404 });
    }

    const fileContent = await fs.promises.readFile(file.path);

    return new Response(new Uint8Array(fileContent), {
      headers: {
        'Content-Type': file.contentType,
        'Content-Length': String(file.size),
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`获取文件失败: ${errorMessage}`);
    return new Response('服务器错误', { status: 500 });
  }
}
