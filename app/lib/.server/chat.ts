import { createScopedLogger } from '~/lib/.server/logger';
import { prisma } from '~/lib/.server/prisma';

const logger = createScopedLogger('chat.server');

/**
 * 聊天创建参数接口
 */
export interface ChatCreateParams {
  userId: string;
  id?: string;
  // 聊天URL ID
  urlId?: string;
  // 聊天描述
  description?: string;
  // 包含额外信息的元数据
  metadata?: Record<string, any>;
}

/**
 * 聊天更新参数接口
 */
export interface ChatUpdateParams {
  description?: string;
  metadata?: Record<string, any>;
}

/**
 * 聊天创建或更新参数接口
 */
export interface ChatUpsertParams {
  id: string;
  userId: string;
  urlId?: string;
  description?: string;
  metadata?: Record<string, any>;
}

/**
 * 创建新的聊天
 * @param params 聊天创建参数
 * @returns 创建的聊天记录
 */
export async function createChat(params: ChatCreateParams) {
  const { userId, id, urlId, description, metadata } = params;

  try {
    const chat = await prisma.chat.create({
      data: {
        ...(id ? { id } : {}),
        userId,
        urlId,
        description,
        metadata,
      },
    });

    logger.info(`[Chat] 创建了用户 ${userId} 的聊天: ${chat.id}`);
    return chat;
  } catch (error) {
    logger.error('[Chat] 创建聊天失败:', error);
    throw error;
  }
}

/**
 * 根据ID获取聊天
 * @param id 聊天ID
 * @returns 聊天记录
 */
export async function getChatById(id: string) {
  try {
    const chat = await prisma.chat.findUnique({
      where: { id },
      include: {
        messages: {
          where: {
            isDiscarded: false,
          },
          orderBy: {
            createdAt: 'asc',
          },
          include: {
            sections: true,
            page: true,
          },
        },
      },
    });

    return chat;
  } catch (error) {
    logger.error(`[Chat] 获取聊天 ${id} 失败:`, error);
    throw error;
  }
}

/**
 * 根据 URL ID 获取聊天
 * @param urlId 聊天的 URL ID
 * @returns 聊天记录
 */
export async function getChatByUrlId(urlId: string) {
  try {
    const chat = await prisma.chat.findUnique({
      where: { urlId },
      include: {
        messages: {
          where: {
            isDiscarded: false,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    return chat;
  } catch (error) {
    logger.error(`[Chat] 获取聊天 URL ${urlId} 失败:`, error);
    throw error;
  }
}

/**
 * 获取用户的所有聊天
 * @param userId 用户ID
 * @param limit 限制返回记录数量
 * @param offset 偏移量
 * @returns 聊天记录列表
 */
export async function getUserChats(userId: string, limit = 20, offset = 0) {
  try {
    const chats = await prisma.chat.findMany({
      where: { userId },
      include: {
        messages: {
          where: {
            isDiscarded: false,
          },
          take: 1,
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      skip: offset,
      take: limit,
    });

    const total = await prisma.chat.count({
      where: { userId },
    });

    return {
      chats,
      total,
    };
  } catch (error) {
    logger.error(`[Chat] 获取用户 ${userId} 的聊天列表失败:`, error);
    throw error;
  }
}

/**
 * 更新聊天信息
 * @param id 聊天ID
 * @param params 更新参数
 * @returns 更新后的聊天记录
 */
export async function updateChat(id: string, params: ChatUpdateParams) {
  try {
    const updatedChat = await prisma.chat.update({
      where: { id },
      data: {
        ...params,
        version: {
          increment: 1,
        },
      },
    });

    logger.info(`[Chat] 更新了聊天 ${id}`);
    return updatedChat;
  } catch (error) {
    logger.error(`[Chat] 更新聊天 ${id} 失败:`, error);
    throw error;
  }
}

/**
 * 删除聊天
 * @param id 聊天ID
 * @returns 删除结果
 *
 * 注意：由于在 Prisma Schema 中配置了级联删除关系：
 *
 * 1. 删除 Chat 会自动级联删除所有关联的 Message 记录
 * 2. 删除 Message 会自动级联删除关联的 Section 记录
 */
export async function deleteChat(id: string) {
  try {
    const chatToDelete = await prisma.chat.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });

    if (!chatToDelete) {
      logger.info(`[Chat] 未找到ID为 ${id} 的聊天，无法删除`);
      return false;
    }

    await prisma.chat.delete({
      where: { id },
    });

    logger.info(`[Chat] 删除了聊天 ${id}，级联删除了 ${chatToDelete._count.messages} 条关联消息及其项目数据`);
    return true;
  } catch (error) {
    logger.error(`[Chat] 删除聊天 ${id} 失败:`, error);
    throw error;
  }
}

/**
 * 获取或创建指定ID的聊天
 * @param chatId 指定的聊天ID
 * @param params 创建聊天所需的参数
 * @returns 聊天记录
 */
export async function getOrCreateChat(chatId: string, params: Omit<ChatCreateParams, 'id'>) {
  try {
    // 尝试查找现有聊天
    const existingChat = await getChatById(chatId);

    if (existingChat) {
      logger.info(`[Chat] 找到现有聊天: ${chatId}`);
      return existingChat;
    }

    // 聊天不存在，创建新聊天，使用指定的ID
    const newChat = await createChat({
      ...params,
      id: chatId,
    });
    logger.info(`[Chat] 聊天不存在，创建新聊天: ${newChat.id}`);
    return newChat;
  } catch (error) {
    logger.error(`[Chat] 获取或创建聊天失败:`, error);
    throw error;
  }
}

/**
 * 根据 ID 获取当前用户的聊天
 * @param id 聊天ID
 * @returns 聊天记录
 */
export async function getUserChatById(id: string, userId: string) {
  try {
    const chat = await prisma.chat.findUnique({
      where: { id, userId },
      include: {
        messages: {
          where: {
            isDiscarded: false,
          },
          orderBy: {
            createdAt: 'asc',
          },
          include: {
            sections: true,
            page: true,
          },
        },
      },
    });

    return chat;
  } catch (error) {
    logger.error(`[Chat] 获取聊天 ${id} 失败:`, error);
    throw error;
  }
}

/**
 * 根据ID创建或更新聊天（upsert操作）
 * @param params 聊天创建或更新参数
 * @returns 创建或更新后的聊天记录
 */
export async function upsertChat(params: ChatUpsertParams) {
  const { id, userId, urlId, description, metadata } = params;

  try {
    const chat = await prisma.chat.upsert({
      where: { id },
      update: {
        version: {
          increment: 1,
        },
        description,
        metadata,
      },
      create: {
        id,
        userId,
        urlId,
        description,
        metadata,
      },
    });

    logger.info(`[Chat] 创建或更新了聊天 ${id}`);
    return chat;
  } catch (error) {
    logger.error(`[Chat] 创建或更新聊天 ${id} 失败:`, error);
    throw error;
  }
}
