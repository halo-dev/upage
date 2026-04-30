import type { Message, Prisma } from '@prisma/client';
import type { JsonArray } from '@prisma/client/runtime/library';
import type { TextUIPart, UIMessagePart } from 'ai';
import { prisma } from '~/.server/service/prisma';
import { createScopedLogger } from '~/.server/utils/logger';
import type { ChatUIMessage, PageBuilderUITools, SummaryAnnotation, UPageDataParts } from '~/types/message';
import { createSummaryPart, ensureProtocolVersion, getMessagePlainTextContent } from '~/utils/message-protocol';

export {
  getMessagePlainTextContent,
  isLegacyXmlMessage,
  upgradeLegacyMessagesForContinuation,
  upgradeLegacyMessageToStructuredParts,
} from '~/utils/message-protocol';

const logger = createScopedLogger('message.server');
type MessagePersistenceClient = Pick<typeof prisma, 'chat' | 'message'>;
export const MESSAGE_ORDER_ASC: Prisma.MessageOrderByWithRelationInput[] = [{ createdAt: 'asc' }, { id: 'asc' }];
export const MESSAGE_ORDER_DESC: Prisma.MessageOrderByWithRelationInput[] = [{ createdAt: 'desc' }, { id: 'desc' }];

function hasPersistedParts(parts: Message['parts']): parts is NonNullable<Message['parts']> {
  return Array.isArray(parts) && parts.length > 0;
}

function partitionOrderedMessageIds(messageIds: string[], targetId: string) {
  const targetIndex = messageIds.indexOf(targetId);

  if (targetIndex === -1) {
    return {
      beforeOrEqual: [] as string[],
      after: [] as string[],
      found: false,
    };
  }

  return {
    beforeOrEqual: messageIds.slice(0, targetIndex + 1),
    after: messageIds.slice(targetIndex + 1),
    found: true,
  };
}

async function getOrderedActiveMessageIds(
  chatId: string,
  db: Pick<typeof prisma, 'message'> = prisma,
): Promise<string[]> {
  const messages = await db.message.findMany({
    where: {
      chatId,
      isDiscarded: false,
    },
    select: {
      id: true,
    },
    orderBy: MESSAGE_ORDER_ASC,
  });

  return messages.map((message) => message.id);
}

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
        version: 2,
      },
      create: {
        id,
        chatId,
        userId,
        role,
        content,
        revisionId,
        annotations,
        version: 2,
      },
    });

    logger.info(`创建或更新了消息 ${id}`);
    return message;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`创建或更新消息 ${id} 失败: ${errorMessage}`);
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
export async function updateDiscardedMessage(
  chatId: string,
  startMessageId: string,
  db: MessagePersistenceClient = prisma,
) {
  try {
    const orderedMessageIds = await getOrderedActiveMessageIds(chatId, db);
    const { after: discardedMessageIds, found } = partitionOrderedMessageIds(orderedMessageIds, startMessageId);

    if (!found) {
      logger.error(`找不到开始消息 ${startMessageId}`);
      return false;
    }

    if (discardedMessageIds.length === 0) {
      logger.info(`聊天 ${chatId} 中消息 ${startMessageId} 之后没有需要遗弃的消息`);
      return true;
    }

    const result = await db.message.updateMany({
      where: {
        chatId,
        id: {
          in: discardedMessageIds,
        },
      },
      data: {
        isDiscarded: true,
      },
    });

    logger.info(`已将聊天 ${chatId} 中 ${startMessageId} 之后的 ${result.count} 条消息标记为遗弃`);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`更新遗弃消息失败: ${errorMessage}`);
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
export async function getHistoryChatMessages(params: GetHistoryChatMessagesParams): Promise<ChatUIMessage[]> {
  const { chatId, rewindTo } = params;

  try {
    if (rewindTo) {
      const orderedMessageIds = await getOrderedActiveMessageIds(chatId);
      const { beforeOrEqual: selectedMessageIds, found } = partitionOrderedMessageIds(orderedMessageIds, rewindTo);

      if (!found) {
        logger.warn(`获取历史消息: 找不到指定的 rewindTo 消息 ${rewindTo}`);
        return await getAllChatMessages(chatId);
      }

      const messages = await prisma.message.findMany({
        where: {
          id: {
            in: selectedMessageIds,
          },
        },
        orderBy: MESSAGE_ORDER_ASC,
      });

      logger.info(`获取了聊天 ${chatId} 中直到消息 ${rewindTo} 的 ${messages.length} 条历史消息`);
      return messages.map(convertToUIMessage);
    } else {
      // 如果没有指定 rewindTo，则获取所有消息
      return await getAllChatMessages(chatId);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`获取聊天 ${chatId} 的历史消息失败: ${errorMessage}`);
    throw error;
  }
}

export function createStructuredPageSummary(message: Pick<ChatUIMessage, 'parts'>): string {
  void message;
  return '';
}

export function convertToUIMessage(message: Message): ChatUIMessage {
  if (message.version === 2 || hasPersistedParts(message.parts)) {
    return {
      id: message.id,
      role: message.role as 'user' | 'assistant',
      parts: (message.parts as any[]) || [],
      metadata: ensureProtocolVersion(message.metadata, 'structured-parts-v2'),
    };
  }

  const parts: UIMessagePart<UPageDataParts, PageBuilderUITools>[] = [];
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
        parts.push(createSummaryPart(annotation as SummaryAnnotation));
      }
    });
  }
  return {
    id: message.id,
    role: message.role as 'user' | 'assistant',
    parts,
    metadata: ensureProtocolVersion(message.metadata, 'legacy-xml'),
  };
}

/**
 * 获取聊天的所有消息（内部辅助方法）
 * @param chatId 聊天ID
 * @returns 消息记录列表
 */
async function getAllChatMessages(chatId: string): Promise<ChatUIMessage[]> {
  const messages = await prisma.message.findMany({
    where: {
      chatId,
      isDiscarded: false,
    },
    orderBy: MESSAGE_ORDER_ASC,
  });

  logger.info(`获取了聊天 ${chatId} 的所有 ${messages.length} 条历史消息`);
  return messages.map(convertToUIMessage);
}

/**
 * 保存聊天消息列表到数据库
 * @param chatId 聊天ID
 * @param messages 消息列表（ChatUIMessage[]）
 * @returns 保存结果
 */
export async function saveChatMessages(
  chatId: string,
  messages: ChatUIMessage[],
  db: MessagePersistenceClient = prisma,
): Promise<number> {
  if (!messages || messages.length === 0) {
    logger.warn('保存聊天消息: 没有提供消息数据');
    return 0;
  }

  try {
    // 获取聊天的用户ID
    const chat = await db.chat.findUnique({
      where: { id: chatId },
      select: { userId: true },
    });

    if (!chat) {
      logger.error(`保存聊天消息: 找不到聊天 ${chatId}`);
      throw new Error(`找不到聊天 ${chatId}`);
    }

    const userId = chat.userId;
    let savedCount = 0;

    // 逐条保存消息
    for (const message of messages) {
      // 跳过没有ID的消息
      if (!message.id) {
        logger.warn('保存聊天消息: 跳过没有ID的消息');
        continue;
      }

      // 提取消息的文本内容
      const content = getMessagePlainTextContent(message);

      // 创建或更新消息
      const updateData: any = {
        content,
        parts: message.parts || [],
        metadata: ensureProtocolVersion(message.metadata, 'structured-parts-v2'),
        isDiscarded: false,
        version: 2,
      };

      const createData: any = {
        id: message.id,
        chatId,
        userId,
        role: message.role,
        content,
        parts: message.parts || [],
        metadata: ensureProtocolVersion(message.metadata, 'structured-parts-v2'),
        isDiscarded: false,
        version: 2,
      };

      await db.message.upsert({
        where: { id: message.id },
        update: updateData,
        create: createData,
      });

      savedCount++;
    }

    logger.info(`成功保存了聊天 ${chatId} 的 ${savedCount} 条消息`);
    return savedCount;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`保存聊天消息失败: ${errorMessage}`);
    throw error;
  }
}
