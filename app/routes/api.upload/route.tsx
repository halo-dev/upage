import { type ActionFunctionArgs } from '@remix-run/node';
import { requireAuth } from '~/.server/service/auth';
import { storageProvider } from '~/.server/storage/index.server';
import { errorResponse, successResponse } from '~/.server/utils/api-response';
import { createScopedLogger } from '~/.server/utils/logger';

const logger = createScopedLogger('api.upload');

/**
 * 处理文件上传请求
 *
 * 参数：
 * - file: 要上传的文件
 *
 * 返回：
 * - url: 文件访问URL
 * - filename: 文件名
 * - contentType: 文件类型
 * - size: 文件大小（字节）
 */
export async function action({ request }: ActionFunctionArgs) {
  try {
    const authResult = await requireAuth(request, { isApi: true });
    if (authResult instanceof Response) {
      return authResult;
    }

    const userId = authResult.userInfo?.sub;
    if (!userId) {
      return errorResponse(401, '用户未登录');
    }

    if (request.method !== 'POST') {
      return errorResponse(405, '不支持的请求方法');
    }

    // 获取上传的文件
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return errorResponse(400, '未找到有效的文件');
    }

    const maxFileSizeMB = process.env.MAX_UPLOAD_SIZE_MB ? parseInt(process.env.MAX_UPLOAD_SIZE_MB) : 5;
    const maxFileSize = maxFileSizeMB * 1024 * 1024;

    if (file.size > maxFileSize) {
      return errorResponse(413, `文件大小超过限制，最大允许${maxFileSizeMB}MB`);
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const result = await storageProvider.uploadFile({
      userId,
      contentType: file.type || 'application/octet-stream',
      filename: file.name,
      data: fileBuffer,
    });

    return successResponse(
      {
        url: storageProvider.getFileUrl(userId, result.filename),
        filename: result.filename,
        contentType: result.contentType,
        size: result.size,
      },
      '文件上传成功',
    );
  } catch (error) {
    logger.error('文件上传失败:', error);
    return errorResponse(500, '文件上传失败');
  }
}
