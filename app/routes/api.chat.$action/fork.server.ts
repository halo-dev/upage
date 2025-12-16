import type { ActionFunctionArgs } from '@remix-run/node';
import { getUserChatById } from '~/.server/service/chat';
import { prisma } from '~/.server/service/prisma';
import { errorResponse, successResponse } from '~/.server/utils/api-response';
import { createScopedLogger } from '~/.server/utils/logger';

const logger = createScopedLogger('api.chat.fork');

export type HandleForkActionArgs = ActionFunctionArgs & {
  userId: string;
};

/**
 * 处理复制聊天操作
 */
export async function handleForkAction({ request, userId }: HandleForkActionArgs) {
  try {
    const { sourceChatId, messageId } = await request.json();

    if (!sourceChatId) {
      return errorResponse(400, '源聊天ID不能为空');
    }

    const sourceChat = await getUserChatById(sourceChatId, userId);
    if (!sourceChat) {
      return errorResponse(404, '找不到源聊天');
    }

    // 使用事务处理整个复制过程，确保数据一致性
    return await prisma.$transaction(async (tx) => {
      logger.debug(`开始复制聊天 ${sourceChatId} 的数据...`);

      const metadata =
        sourceChat.metadata &&
        typeof sourceChat.metadata === 'object' &&
        !Array.isArray(sourceChat.metadata) &&
        sourceChat.metadata !== null
          ? (sourceChat.metadata as Record<string, any>)
          : undefined;

      // 创建新聊天
      const newChat = await tx.chat.create({
        data: {
          userId,
          description: `${sourceChat.description || 'Chat'} (Copy)`,
          urlId: sourceChat.urlId || undefined,
          metadata,
        },
      });

      logger.debug(`为用户 ${userId} 创建了聊天副本: ${newChat.id}`);

      // 检查是否有消息需要复制
      if (sourceChat.messages && sourceChat.messages.length > 0) {
        // 根据messageId过滤消息
        let messagesToCopy = sourceChat.messages;

        // 如果指定了messageId，过滤消息
        if (messageId) {
          const targetIndex = messagesToCopy.findIndex((msg) => msg.id === messageId);

          if (targetIndex === -1) {
            await tx.chat.delete({ where: { id: newChat.id } });
            logger.warn('在聊天中找不到指定的消息', { sourceChatId, messageId });
            return errorResponse(404, '在聊天中找不到指定的消息');
          }

          // 只保留从 0 到 targetIndex 的消息
          messagesToCopy = messagesToCopy.slice(0, targetIndex + 1);

          logger.debug(`将复制聊天 ${sourceChatId} 的前 ${messagesToCopy.length} 条消息（到消息ID: ${messageId}）`);
        } else {
          logger.debug(`将复制聊天 ${sourceChatId} 的全部 ${messagesToCopy.length} 条消息`);
        }

        // 准备批量创建消息的数据
        // 由于 prisma 中 output 与 input 类型不一致，需要手动复制 https://github.com/prisma/prisma/issues/9247
        const messageCreateData = messagesToCopy.map((msg) => ({
          chatId: newChat.id,
          userId,
          role: msg.role,
          content: msg.content,
          annotations: msg.annotations || undefined,
          metadata: msg.metadata || undefined,
          parts: msg.parts || undefined,
          revisionId: msg.revisionId || undefined,
          isDiscarded: msg.isDiscarded || false,
        }));

        logger.debug('批量创建消息数据', JSON.stringify(messageCreateData));

        // 使用批量创建消息函数创建消息
        await tx.message.createMany({
          data: messageCreateData,
        });

        logger.debug(`为聊天 ${newChat.id} 批量创建了 ${messageCreateData.length} 条消息`);

        const newMessages = await tx.message.findMany({
          where: { chatId: newChat.id },
          orderBy: { createdAt: 'asc' },
        });

        // 创建映射：原消息ID -> 新消息对象
        const messageMapping = messagesToCopy.reduce(
          (map, oldMsg, index) => {
            map[oldMsg.id] = newMessages[index];
            return map;
          },
          {} as Record<string, any>,
        );

        const pageToCreate = messagesToCopy
          .filter((msg) => msg.page != null)
          .map((msg) => {
            const page = msg.page!;
            return {
              messageId: messageMapping[msg.id].id,
              pages: JSON.parse(JSON.stringify(page.pages)),
            };
          });

        // 批量创建 Page 项目数据
        if (pageToCreate.length > 0) {
          await tx.page.createMany({
            data: pageToCreate,
          });
          logger.debug(`为聊天 ${newChat.id} 批量创建了 ${pageToCreate.length} 个Page项目`);
        }

        // 收集需要创建的区块数据
        const sectionsToCreate = [];
        for (const msg of messagesToCopy) {
          if (msg.sections && msg.sections.length > 0) {
            for (const section of msg.sections) {
              sectionsToCreate.push({
                messageId: messageMapping[msg.id].id,
                type: section.type,
                action: section.action,
                actionId: section.actionId,
                pageName: section.pageName,
                content: section.content,
                domId: section.domId,
                sort: section.sort,
                rootDomId: section.rootDomId,
              });
            }
          }
        }

        // 批量创建区块数据
        if (sectionsToCreate.length > 0) {
          await tx.section.createMany({
            data: sectionsToCreate,
          });
          logger.debug(`为聊天 ${newChat.id} 批量创建了 ${sectionsToCreate.length} 个区块`);
        }
      }

      // 返回新聊天ID
      return successResponse(newChat.id, '聊天复制成功');
    });
  } catch (error) {
    logger.error('复制聊天失败:', error);
    return errorResponse(500, '服务器处理请求失败');
  }
}
