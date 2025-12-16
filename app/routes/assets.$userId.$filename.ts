import { type LoaderFunctionArgs } from '@remix-run/node';
import fs from 'fs';
import { getUser } from '~/.server/service/auth';
import { storageProvider } from '~/.server/storage/index.server';
import { createScopedLogger } from '~/.server/utils/logger';

const logger = createScopedLogger('api.assets');

/**
 * 处理文件访问请求, 只有文件所有者可以访问
 */
export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const { userId, filename } = params;

    if (!userId || !filename) {
      return new Response('文件不存在', { status: 404 });
    }

    const authResult = await getUser(request);
    const currentUserId = authResult.userInfo?.sub;

    const fileExists = await storageProvider.fileExists(userId, filename);
    if (!fileExists) {
      logger.debug('文件不存在', { userId, filename });
      return new Response('文件不存在', { status: 404 });
    }

    if (currentUserId !== userId) {
      logger.warn('无权访问文件', { userId, currentUserId, filename });
      return new Response('无权访问此文件', { status: 403 });
    }

    const file = await storageProvider.getFile(userId, filename);
    if (!file) {
      logger.debug('文件不存在', { userId, filename });
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
    logger.error('获取文件失败:', error);
    return new Response('服务器错误', { status: 500 });
  }
}
