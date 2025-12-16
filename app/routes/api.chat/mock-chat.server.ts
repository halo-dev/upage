import type { ActionFunctionArgs } from '@remix-run/node';
import { generateId } from 'ai';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { createScopedLogger } from '~/.server/utils/logger';

const logger = createScopedLogger('api.chat.mock-chat');

/**
 * 处理 mock 数据的流式输出，通常用于开发环境下使用。
 */
export async function mockChat(_args: ActionFunctionArgs, filePath: string = 'mock_stream_text_1.txt') {
  try {
    const id = generateId();
    // 读取 mock 数据文件
    const mockFilePath = join(process.cwd(), 'mock', filePath);
    const fileContent = await readFile(mockFilePath, 'utf-8');
    const lines = fileContent.split('\n').map((line) => {
      // 替换 messageId 为生成 id，data: {"type":"start","messageId":"uoLyIATGAm28y7rP"}
      if (line.includes('messageId')) {
        const startData = JSON.parse(line.replace('data: ', ''));
        startData.messageId = id;
        return `data: ${JSON.stringify(startData)}`;
      }
      return line;
    });

    // 创建一个 ReadableStream 来按行输出内容
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // 按行输出内容，每行之间添加延迟
        for (const line of lines) {
          if (line.trim() !== '') {
            controller.enqueue(encoder.encode(`${line}\n\n`));
            // 添加小延迟，模拟真实的流式输出
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
        }
        controller.close();
      },
    });

    // 返回 Response 对象
    return new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        Connection: 'keep-alive',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`Mock 数据流式输出错误: ${errorMessage}`);
    throw new Response(`Mock 数据流式输出错误: ${errorMessage}`, {
      status: 500,
      statusText: 'Internal Server Error',
    });
  }
}
