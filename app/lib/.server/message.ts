import type { Message } from '@prisma/client';
import type { JsonArray } from '@prisma/client/runtime/library';
import type { TextUIPart, UIMessagePart } from 'ai';
import { createScopedLogger } from '~/lib/.server/logger';
import { prisma } from '~/lib/.server/prisma';
import type { SummaryAnnotation, UPageDataParts, UPageUIMessage } from '~/types/message';

const logger = createScopedLogger('message.server');

/**
 * 消息创建参数接口
 */
export interface MessageCreateParams {
  chatId: string;
  userId: string;
  role: string;
  content: string;
  revisionId?: string;
  annotations?: any[];
  version?: number;
}

/**
 * 消息更新参数接口
 */
export interface MessageUpdateParams {
  content?: string;
  revisionId?: string;
  annotations?: any[];
  version?: number;
}

/**
 * 消息创建或更新参数接口
 */
export interface MessageUpsertParams {
  id: string;
  chatId: string;
  userId: string;
  role: string;
  content: string;
  revisionId?: string;
  annotations?: any[];
  version?: number;
}

/**
 * 根据ID创建或更新消息（upsert操作）
 * @param params 消息创建或更新参数
 * @returns 创建或更新后的消息记录
 */
export async function upsertMessage(params: MessageUpsertParams) {
  const { id, chatId, userId, role, content, revisionId, annotations } = params;

  try {
    const message = await prisma.message.upsert({
      where: { id },
      update: {
        content,
        revisionId,
        annotations,
      },
      create: {
        id,
        chatId,
        userId,
        role,
        content,
        revisionId,
        annotations,
      },
    });

    logger.info(`[Message] 创建或更新了消息 ${id}`);
    return message;
  } catch (error) {
    logger.error(`[Message] 创建或更新消息 ${id} 失败:`, error);
    throw error;
  }
}

/**
 * 更新消息为遗弃消息。
 *
 * 此方法将会更新同一 {@param chatId} 下 startMessageId（不含）与 endMessageId 之间（不含）的所有消息为遗弃消息。
 *
 * @param chatId 聊天ID
 * @param startMessageId 开始消息ID
 * @param endMessageId 结束消息ID
 */
export async function updateDiscardedMessage(chatId: string, startMessageId: string) {
  try {
    const startMessage = await prisma.message.findUnique({
      where: { id: startMessageId },
      select: { createdAt: true },
    });

    if (!startMessage) {
      logger.error(`[Message] 找不到开始消息 ${startMessageId}`);
      return false;
    }

    // 更新 startMessageId 之后的所有消息为遗弃消息
    const result = await prisma.message.updateMany({
      where: {
        chatId,
        createdAt: {
          gt: startMessage?.createdAt,
        },
      },
      data: {
        isDiscarded: true,
      },
    });

    logger.info(`[Message] 已将聊天 ${chatId} 中 ${startMessageId} 之后的 ${result.count} 条消息标记为遗弃`);
    return true;
  } catch (error) {
    logger.error(`[Message] 更新遗弃消息失败:`, error);
    throw error;
  }
}

/**
 * 获取历史聊天消息接口参数
 */
export interface GetHistoryChatMessagesParams {
  chatId: string;
  rewindTo?: string;
}

/**
 * 获取从第一条消息到指定消息之间的所有历史消息
 * @param params 包含 chatId 和可选的 rewindTo 参数
 * @returns 消息记录列表
 */
export async function getHistoryChatMessages(params: GetHistoryChatMessagesParams): Promise<UPageUIMessage[]> {
  const { chatId, rewindTo } = params;

  try {
    // 如果指定了 rewindTo，则获取该消息的创建时间
    if (rewindTo) {
      const rewindToMessage = await prisma.message.findUnique({
        where: { id: rewindTo },
        select: { createdAt: true },
      });

      if (!rewindToMessage) {
        logger.warn(`[Message] 获取历史消息: 找不到指定的 rewindTo 消息 ${rewindTo}`);
        // 如果找不到指定消息，则返回所有消息
        return await getAllChatMessages(chatId);
      }

      // 获取所有在 rewindTo 消息创建时间之前（包括该消息）的消息
      const messages = await prisma.message.findMany({
        where: {
          chatId,
          isDiscarded: false,
          createdAt: {
            lte: rewindToMessage.createdAt,
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      logger.info(`[Message] 获取了聊天 ${chatId} 中直到消息 ${rewindTo} 的 ${messages.length} 条历史消息`);
      return messages.map(convertToUIMessage);
    } else {
      // 如果没有指定 rewindTo，则获取所有消息
      return await getAllChatMessages(chatId);
    }
  } catch (error) {
    logger.error(`[Message] 获取聊天 ${chatId} 的历史消息失败:`, error);
    throw error;
  }
}

function convertToUIMessage(message: Message): UPageUIMessage {
  if (message.version === 2) {
    return {
      id: message.id,
      role: message.role as 'user' | 'assistant',
      parts: message.parts as any[],
      metadata: message.metadata as any,
    };
  }

  const parts: UIMessagePart<UPageDataParts, never>[] = [];
  if (message.role === 'user') {
    const content = JSON.parse(message.content) as TextUIPart;
    parts.push({
      type: 'text',
      text: content.text,
    });
  } else {
    parts.push({
      type: 'text',
      text: message.content,
    });
  }

  if (message.annotations) {
    const messageAnnotations = message.annotations as JsonArray;
    messageAnnotations.forEach((annotation) => {
      const { type } = annotation as { type: string };
      if (type === 'chatSummary') {
        parts.push({
          type: 'data-summary',
          data: annotation as unknown as SummaryAnnotation,
        });
      }
    });
  }
  return {
    id: message.id,
    role: message.role as 'user' | 'assistant',
    parts,
    metadata: message.metadata as any,
  };
}

/**
 * 获取聊天的所有消息（内部辅助方法）
 * @param chatId 聊天ID
 * @returns 消息记录列表
 */
async function getAllChatMessages(chatId: string): Promise<UPageUIMessage[]> {
  const messages = await prisma.message.findMany({
    where: {
      chatId,
      isDiscarded: false,
    },
    orderBy: {
      createdAt: 'asc',
    },
  });

  logger.info(`[Message] 获取了聊天 ${chatId} 的所有 ${messages.length} 条历史消息`);
  return messages.map(convertToUIMessage);
}

/**
 * 保存聊天消息列表到数据库
 * @param chatId 聊天ID
 * @param messages 消息列表（UPageUIMessage[]）
 * @returns 保存结果
 */
export async function saveChatMessages(chatId: string, messages: UPageUIMessage[]): Promise<number> {
  if (!messages || messages.length === 0) {
    logger.warn('[Message] 保存聊天消息: 没有提供消息数据');
    return 0;
  }

  try {
    // 获取聊天的用户ID
    const chat = await prisma.chat.findUnique({
      where: { id: chatId },
      select: { userId: true },
    });

    if (!chat) {
      logger.error(`[Message] 保存聊天消息: 找不到聊天 ${chatId}`);
      throw new Error(`找不到聊天 ${chatId}`);
    }

    const userId = chat.userId;
    let savedCount = 0;

    // 逐条保存消息
    for (const message of messages) {
      // 跳过没有ID的消息
      if (!message.id) {
        logger.warn('[Message] 保存聊天消息: 跳过没有ID的消息');
        continue;
      }

      // 提取消息的文本内容
      const textPart = message.parts.find((part) => part.type === 'text');
      const content = textPart?.text || '';

      // 创建或更新消息
      const updateData: any = {
        content,
        parts: message.parts,
        metadata: message.metadata,
        version: 2,
      };

      const createData: any = {
        id: message.id,
        chatId,
        userId,
        role: message.role,
        content,
        parts: message.parts,
        metadata: message.metadata,
        version: 2,
      };

      await prisma.message.upsert({
        where: { id: message.id },
        update: updateData,
        create: createData,
      });

      savedCount++;
    }

    logger.info(`[Message] 成功保存了聊天 ${chatId} 的 ${savedCount} 条消息`);
    return savedCount;
  } catch (error) {
    logger.error(`[Message] 保存聊天消息失败:`, error);
    throw error;
  }
}
