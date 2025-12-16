import { generateDeploymentFiles } from '~/.server/service/files-generator';
import { errorResponse, successResponse } from '~/.server/utils/api-response';
import { createScopedLogger } from '~/.server/utils/logger';
import { convertStringToBase64 } from '~/utils/file-utils';

const logger = createScopedLogger('api.project.files');

interface GetProjectFilesParams {
  request: Request;
  userId: string;
}

/**
 * 获取项目文件列表
 * @param params 请求参数
 * @returns 文件映射 {filename: content}
 */
export async function getProjectFiles({ request, userId }: GetProjectFilesParams) {
  try {
    const formData = await request.formData();
    const messageId = formData.get('messageId')?.toString();

    if (!messageId) {
      return errorResponse(400, '缺少 messageId 参数');
    }

    logger.info(`用户 ${userId} 请求获取项目文件: messageId=${messageId}`);

    // 生成部署文件
    const files = await generateDeploymentFiles({
      messageId,
      inner: false,
    });

    if (Object.keys(files).length === 0) {
      return errorResponse(404, '没有找到可用的文件');
    }

    // 将文件内容转换为字符串格式（二进制文件转为 base64）
    const fileContents: Record<string, string> = {};

    for (const [filename, content] of Object.entries(files)) {
      if (Buffer.isBuffer(content)) {
        // Buffer 转为 base64
        fileContents[filename] = convertStringToBase64(filename, content.toString('binary'));
      } else if (typeof content === 'string') {
        // 字符串，可能需要转为 base64
        fileContents[filename] = convertStringToBase64(filename, content);
      } else {
        logger.warn(`未知的内容类型: ${filename}`);
      }
    }

    logger.info(`成功获取 ${Object.keys(fileContents).length} 个文件`);

    return successResponse(
      {
        files: fileContents,
      },
      '获取文件列表成功',
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`获取项目文件失败: ${errorMessage}`);
    return errorResponse(500, `获取项目文件失败: ${errorMessage}`);
  }
}
