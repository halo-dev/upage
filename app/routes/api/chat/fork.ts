import type { ActionFunctionArgs } from 'react-router';
import { requireAuth } from '~/.server/service/auth';
import { getUserChatById } from '~/.server/service/chat';
import { prisma } from '~/.server/service/prisma';
import { errorResponse, successResponse } from '~/.server/utils/api-response';
import { createScopedLogger } from '~/.server/utils/logger';

const logger = createScopedLogger('api.chat.fork');

export async function action({ request }: ActionFunctionArgs) {
  const authResult = await requireAuth(request, { isApi: true });
  if (authResult instanceof Response) {
    return authResult;
  }

  const userId = authResult.userInfo?.sub;
  if (!userId) {
    return errorResponse(401, '用户未登录');
  }

  return handleFork({ request, userId });
}
/**
 * 处理复制聊天操作
 */
async function handleFork({ request, userId }: { request: Request; userId: string }) {
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
          : {};

      metadata.forkedFrom = sourceChatId;
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
          version: msg.version || 2,
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

        // 收集需要创建的 PageV2 数据
        const pageV2ToCreate = [];
        for (const msg of messagesToCopy) {
          if (msg.pagesV2 && msg.pagesV2.length > 0) {
            for (const pageV2 of msg.pagesV2) {
              pageV2ToCreate.push({
                oldPageV2: pageV2,
                newMessageId: messageMapping[msg.id].id,
                data: {
                  messageId: messageMapping[msg.id].id,
                  name: pageV2.name,
                  title: pageV2.title,
                  content: pageV2.content,
                  actionIds: pageV2.actionIds || [],
                  headMeta: pageV2.headMeta || undefined,
                  headLinks: pageV2.headLinks || undefined,
                  headScripts: pageV2.headScripts || undefined,
                  headStyles: pageV2.headStyles || undefined,
                  headRaw: pageV2.headRaw || undefined,
                  sort: pageV2.sort,
                },
              });
            }
          }
        }

        // 批量创建 PageV2 并建立映射
        const pageV2Mapping: Record<string, any> = {};
        if (pageV2ToCreate.length > 0) {
          for (const pageV2Item of pageV2ToCreate) {
            const newPageV2 = await tx.pageV2.create({
              data: pageV2Item.data,
            });
            pageV2Mapping[pageV2Item.oldPageV2.id] = newPageV2;
          }
          logger.debug(`为聊天 ${newChat.id} 批量创建了 ${pageV2ToCreate.length} 个PageV2`);
        }

        // 收集需要创建的 PageAsset 数据
        const pageAssetsToCreate = [];
        for (const msg of messagesToCopy) {
          if (msg.pagesV2 && msg.pagesV2.length > 0) {
            for (const pageV2 of msg.pagesV2) {
              if (pageV2.assets && pageV2.assets.length > 0) {
                for (const asset of pageV2.assets) {
                  const newPageV2 = pageV2Mapping[pageV2.id];
                  if (newPageV2) {
                    pageAssetsToCreate.push({
                      pageId: newPageV2.id,
                      filename: asset.filename,
                      storagePath: asset.storagePath,
                      url: asset.url,
                      fileType: asset.fileType,
                      fileSize: asset.fileSize,
                      sort: asset.sort,
                    });
                  }
                }
              }
            }
          }
        }

        // 批量创建 PageAsset
        if (pageAssetsToCreate.length > 0) {
          await tx.pageAsset.createMany({
            data: pageAssetsToCreate,
          });
          logger.debug(`为聊天 ${newChat.id} 批量创建了 ${pageAssetsToCreate.length} 个PageAsset`);
        }

        // 收集需要创建的区块数据
        const sectionsToCreate = [];
        for (const msg of messagesToCopy) {
          if (msg.sections && msg.sections.length > 0) {
            for (const section of msg.sections) {
              const newPageV2Id = section.pageV2Id ? pageV2Mapping[section.pageV2Id]?.id : undefined;

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
                pageV2Id: newPageV2Id || undefined,
                placement: section.placement || 'body',
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
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`复制聊天失败: ${errorMessage}`);
    return errorResponse(500, '服务器处理请求失败');
  }
}
