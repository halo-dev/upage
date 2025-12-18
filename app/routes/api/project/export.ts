import JSZip from 'jszip';
import type { ActionFunctionArgs } from 'react-router';
import { requireAuth } from '~/.server/service/auth';
import { generateDeploymentFiles } from '~/.server/service/files-generator';
import { errorResponse } from '~/.server/utils/api-response';
import { createScopedLogger } from '~/.server/utils/logger';
import { isBinaryString } from '~/utils/file-utils';

const logger = createScopedLogger('api.project.export');

export async function action({ request }: ActionFunctionArgs) {
  const authResult = await requireAuth(request, { isApi: true });
  if (authResult instanceof Response) {
    return authResult;
  }
  const userId = authResult.userInfo?.sub;
  if (!userId) {
    return errorResponse(401, '用户未登录');
  }

  return exportProject({ request, userId });
}

/**
 * 导出项目为 ZIP 文件
 *
 * @param params 请求参数
 * @returns ZIP 文件流
 */
async function exportProject({ request, userId }: { request: Request; userId: string }) {
  try {
    const formData = await request.formData();
    const messageId = formData.get('messageId')?.toString();

    if (!messageId) {
      return errorResponse(400, '缺少 messageId 参数');
    }

    logger.info(`用户 ${userId} 请求导出项目: messageId=${messageId}`);

    // 生成部署文件
    const files = await generateDeploymentFiles({
      messageId,
      inner: false,
    });

    if (Object.keys(files).length === 0) {
      return errorResponse(404, '没有找到可导出的文件');
    }

    // 使用 JSZip 创建 ZIP 文件
    const zip = new JSZip();

    for (const [filename, content] of Object.entries(files)) {
      if (Buffer.isBuffer(content)) {
        // Buffer 类型，直接添加
        zip.file(filename, content, { binary: true });
      } else if (typeof content === 'string') {
        // 字符串类型，判断是否为二进制字符串
        if (isBinaryString(content)) {
          zip.file(filename, Buffer.from(content, 'binary'), { binary: true });
        } else {
          zip.file(filename, content);
        }
      } else {
        logger.warn(`未知的内容类型: ${filename}`);
      }
    }

    // 生成 ZIP 文件
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 9,
      },
    });

    logger.info(`成功生成 ZIP 文件: ${zipBuffer.length} 字节`);

    // 返回 ZIP 文件
    const timestamp = Date.now();
    return new Response(zipBuffer as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="upage_export_${timestamp}.zip"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`导出项目失败: ${errorMessage}`);
    return errorResponse(500, `导出项目失败: ${errorMessage}`);
  }
}
