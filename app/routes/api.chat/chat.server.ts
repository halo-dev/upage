import type { ActionFunctionArgs } from '@remix-run/node';
import {
  consumeStream,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  type UIMessageStreamWriter,
} from 'ai';
import { chatStreamText } from '~/.server/llm/chat-stream-text';
import { MAX_RESPONSE_SEGMENTS, MAX_TOKENS } from '~/.server/llm/constants';
import { createSummary } from '~/.server/llm/create-summary';
import { type SelectContextResult, selectContext } from '~/.server/llm/select-context';
import { structuredPageSnapshot } from '~/.server/llm/structured-page-snapshot';
import { DEFAULT_MODEL, DEFAULT_MODEL_DETAILS, getModel, MINOR_MODEL } from '~/.server/modules/constants';
import { CONTINUE_PROMPT } from '~/.server/prompts/prompts';
import { upsertChat } from '~/.server/service/chat';
import { ChatUsageStatus, recordUsage, updateUsageStatus } from '~/.server/service/chat-usage';
import { getHistoryChatMessages, saveChatMessages, updateDiscardedMessage } from '~/.server/service/message';
import { getPageV2ByMessageId } from '~/.server/service/page-v2';
import { createScopedLogger } from '~/.server/utils/logger';
import { approximateUsageFromContent } from '~/.server/utils/token';
import type { UPageUIMessage } from '~/types/message';
import type { PageData } from '~/types/pages';

const logger = createScopedLogger('api.chat.chat');

export type ElementInfo = {
  tagName: string;
  className?: string;
  id?: string;
  innerHTML?: string;
  outerHTML?: string;
};

export type ChatActionParams = {
  // 当前会话 ID
  chatId: string;
  // 回退到指定消息 ID
  rewindTo: string;
  // 最后一条消息，通常是用户消息。
  message: UPageUIMessage;
  // 如果用户指定编辑的元素，则需要传递该元素的信息。
  elementInfo: ElementInfo;
};

export type ChatActionArgs = ActionFunctionArgs & {
  userId: string;
};

export async function chatAction({ request, userId }: ChatActionArgs) {
  const { rewindTo, chatId, message } = await request.json<ChatActionParams>();
  const chat = await upsertChat({
    id: chatId,
    userId,
  });

  const elementInfo = message.metadata?.elementInfo;
  const messageId = message.id;
  const messageContent = message.parts.find((part) => part.type === 'text')?.text;
  const initialUsageRecord = await recordUsage({
    userId,
    chatId: chat.id,
    messageId,
    status: ChatUsageStatus.PENDING,
    prompt: messageContent || '',
    modelName: DEFAULT_MODEL,
  });

  const minorModelInitialUsageRecord = await recordUsage({
    userId,
    chatId: chat.id,
    messageId,
    status: ChatUsageStatus.PENDING,
    prompt: messageContent || '',
    modelName: MINOR_MODEL,
  });

  let streamSwitches = 0;
  let progressCounter: number = 1;
  const cumulativeUsage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    reasoningTokens: 0,
    cachedInputTokens: 0,
  };
  const minorModelCumulativeUsage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    reasoningTokens: 0,
    cachedInputTokens: 0,
  };

  // 辅助函数：更新辅助模型使用量
  const updateMinorModelUsage = (usage: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    reasoningTokens?: number;
    cachedInputTokens?: number;
  }) => {
    minorModelCumulativeUsage.inputTokens += usage.inputTokens || 0;
    minorModelCumulativeUsage.outputTokens += usage.outputTokens || 0;
    minorModelCumulativeUsage.totalTokens += usage.totalTokens || 0;
    minorModelCumulativeUsage.reasoningTokens += usage.reasoningTokens || 0;
    minorModelCumulativeUsage.cachedInputTokens += usage.cachedInputTokens || 0;
  };

  // 计算用户 token 消耗
  const calculateTokenUsage = async (status: ChatUsageStatus) => {
    try {
      await updateUsageStatus(initialUsageRecord.id, status, {
        inputTokens: cumulativeUsage.inputTokens,
        outputTokens: cumulativeUsage.outputTokens,
        reasoningTokens: cumulativeUsage.reasoningTokens,
        cachedTokens: cumulativeUsage.cachedInputTokens,
        totalTokens: cumulativeUsage.totalTokens,
      });
      logger.debug(`用户 ${userId} 的聊天: ${chat.id} 总使用量为: ${JSON.stringify(cumulativeUsage)}`);
      logger.debug(`用户 ${userId} 的聊天: ${chat.id} 使用状态已更新为 ${status}`);
    } catch (error) {
      logger.error(`更新用户 ${userId} 的使用状态时出错:`, error);
    }
  };

  // 计算用户 token 消耗
  const calculateMinorModelTokenUsage = async (status: ChatUsageStatus) => {
    try {
      await updateUsageStatus(minorModelInitialUsageRecord.id, status, {
        inputTokens: minorModelCumulativeUsage.inputTokens,
        outputTokens: minorModelCumulativeUsage.outputTokens,
        reasoningTokens: minorModelCumulativeUsage.reasoningTokens,
        cachedTokens: minorModelCumulativeUsage.cachedInputTokens,
        totalTokens: minorModelCumulativeUsage.totalTokens,
      });
      logger.debug(`用户 ${userId} 的聊天: ${chat.id} 辅助模型使用状态已更新为 ${status}`);
    } catch (error) {
      logger.error(`更新用户 ${userId} 的辅助模型使用状态时出错:`, error);
      // 记录错误但不中断流程
    }
  };

  const progressId = generateId();
  // 获取从第一条到当前消息之间的所有消息
  const previousMessages = await getHistoryChatMessages({
    chatId,
    rewindTo,
  });
  const messages = [...previousMessages, message];

  const streamExecutor = async ({ writer }: { writer: UIMessageStreamWriter<UPageUIMessage> }) => {
    // 在消息的开头发送一个固定的消息，用于标识消息的开始。
    writer.write({
      type: 'start',
      messageId: generateId(),
    });

    // 辅助 model 所获取的数据，用于后续的模型调用。
    const minorModelData: { summary: string; context: Record<string, SelectContextResult>; pageSummary: string } = {
      summary: '',
      context: {},
      pageSummary: '',
    };

    // 仅当有历史消息时，才调用辅助模型，首次调用无需调用。
    if (previousMessages.length > 0) {
      writer.write({
        type: 'data-progress',
        id: progressId,
        data: {
          label: 'summary',
          status: 'in-progress',
          order: progressCounter++,
          message: '正在分析请求...',
        },
        transient: true,
      });
      // 让 AI 分析用户消息摘要，明确用户下一步的意图。
      const { text: summary, totalUsage: createSummaryUsage } = await createSummary({
        messages,
        model: getModel(MINOR_MODEL),
        abortSignal: request.signal,
      });
      minorModelData.summary = summary;
      updateMinorModelUsage(createSummaryUsage);
      writer.write({
        type: 'data-summary',
        data: {
          summary,
          chatId: chat.id,
        },
      });
      writer.write({
        type: 'data-progress',
        id: progressId,
        data: {
          label: 'summary',
          status: 'complete',
          order: progressCounter++,
          message: '分析完成',
        },
        transient: true,
      });

      // 获取最后一条历史消息所对应的 page
      const lastMessage = previousMessages[previousMessages.length - 1];
      const pageData = await getPageV2ByMessageId(lastMessage.id);
      if (pageData) {
        const pages = pageData as unknown as PageData[];
        // 根据用户摘要和所有的页面数据，让 AI 根据摘要、用户消息、页面数据，选择一部分待修改的页面和待修改的 section。
        writer.write({
          type: 'data-progress',
          id: progressId,
          data: {
            label: 'context',
            status: 'in-progress',
            order: progressCounter++,
            message: '正在对页面进行分析...',
          },
          transient: true,
        });
        const { context, totalUsage: selectContextUsage } = await selectContext({
          messages,
          summary,
          pages,
          model: getModel(MINOR_MODEL),
          abortSignal: request.signal,
        });
        minorModelData.context = context;
        updateMinorModelUsage(selectContextUsage);

        // 调用辅助 model 对 context 中的页面做摘要，如果没有，则对所有页面做摘要。
        const selectPageNames = Object.keys(context);
        const selectedPages = selectPageNames.length > 0 ? pages : pages.map((page) => page);
        const { text: pageSummary, totalUsage: structuredPageSnapshotUsage } = await structuredPageSnapshot({
          pages: selectedPages,
          model: getModel(MINOR_MODEL),
          abortSignal: request.signal,
        });
        minorModelData.pageSummary = pageSummary;
        updateMinorModelUsage(structuredPageSnapshotUsage);
        writer.write({
          type: 'data-progress',
          id: progressId,
          data: {
            label: 'context',
            status: 'complete',
            order: progressCounter++,
            message: '页面分析完成',
          },
          transient: true,
        });
      }
    }

    writer.write({
      type: 'data-progress',
      id: progressId,
      data: {
        label: 'response',
        status: 'in-progress',
        order: progressCounter++,
        message: '正在生成响应',
      },
      transient: true,
    });
    const executeStreamText = async (messages: UPageUIMessage[], isContinue: boolean = false) => {
      const result = await chatStreamText({
        messages,
        elementInfo,
        summary: minorModelData.summary,
        pageSummary: minorModelData.pageSummary,
        context: minorModelData.context,
        maxTokens: DEFAULT_MODEL_DETAILS?.maxTokenAllowed,
        model: getModel(DEFAULT_MODEL),
        abortSignal: request.signal,
        onFinish: async ({ totalUsage, finishReason, text }) => {
          cumulativeUsage.inputTokens += totalUsage.inputTokens || 0;
          cumulativeUsage.outputTokens += totalUsage.outputTokens || 0;
          cumulativeUsage.totalTokens += totalUsage.totalTokens || 0;
          cumulativeUsage.reasoningTokens += totalUsage.reasoningTokens || 0;
          cumulativeUsage.cachedInputTokens += totalUsage.cachedInputTokens || 0;

          if (finishReason === 'length') {
            if (streamSwitches >= MAX_RESPONSE_SEGMENTS) {
              writer.write({
                type: 'data-progress',
                id: progressId,
                data: {
                  label: 'response',
                  status: 'stopped',
                  order: progressCounter++,
                  message: '无法继续生成消息：已达到最大分段数',
                },
                transient: true,
              });
              writer.write({
                type: 'finish',
              });
              return;
            }
            await continueMessage(text);
          }

          if (finishReason === 'stop') {
            writer.write({
              type: 'data-progress',
              id: progressId,
              data: {
                label: 'response',
                status: 'complete',
                order: progressCounter++,
                message: '响应生成完成',
              },
              transient: true,
            });
            writer.write({
              type: 'finish',
            });
          }
        },
        onAbort: async ({ totalUsage }) => {
          cumulativeUsage.inputTokens += totalUsage.inputTokens || 0;
          cumulativeUsage.outputTokens += totalUsage.outputTokens || 0;
          cumulativeUsage.totalTokens += totalUsage.totalTokens || 0;
          cumulativeUsage.reasoningTokens += totalUsage.reasoningTokens || 0;
          cumulativeUsage.cachedInputTokens += totalUsage.cachedInputTokens || 0;
        },
      });

      const continueMessage = async (text: string) => {
        logger.info(
          `达到最大 token 限制 (${DEFAULT_MODEL_DETAILS?.maxTokenAllowed || MAX_TOKENS}): 继续消息, 还可以响应 (${MAX_RESPONSE_SEGMENTS - streamSwitches} 个分段)`,
        );
        messages.push({
          id: generateId(),
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text,
            },
          ],
        });
        messages.push({
          id: generateId(),
          role: 'user',
          parts: [
            {
              type: 'text',
              text: CONTINUE_PROMPT,
            },
          ],
        });

        await executeStreamText(messages, true);
        streamSwitches++;
      };

      writer.merge(
        result.toUIMessageStream({
          sendReasoning: !isContinue,
          sendFinish: false,
          sendStart: false,
        }),
      );
    };
    await executeStreamText([message], false);
  };

  const stream = createUIMessageStream<UPageUIMessage>({
    execute: streamExecutor,
    originalMessages: messages,
    onFinish: async ({ messages, isAborted }) => {
      if (isAborted) {
        // 由于 AI SDK 没有提供在 onAbort 中计算 Token 消耗的方法。所以这里手动计算。
        // https://github.com/vercel/ai/pull/8701
        const lastAssistantMessage = messages.find((message) => message.role === 'assistant');
        if (lastAssistantMessage) {
          cumulativeUsage.outputTokens += approximateUsageFromContent(lastAssistantMessage.parts);
          cumulativeUsage.totalTokens += approximateUsageFromContent(lastAssistantMessage.parts);
        }
      }

      // 根据是否中止设置正确的状态
      // TODO: 在错误情况下，现在还是会被设置为 SUCCESS。
      const status = isAborted ? ChatUsageStatus.ABORTED : ChatUsageStatus.SUCCESS;
      calculateTokenUsage(status);
      calculateMinorModelTokenUsage(status);

      if (isAborted) {
        logger.info(`用户 ${userId} 的聊天: ${chatId} 中止处理完成`);
        return;
      }

      // 保存消息到数据库
      if (rewindTo) {
        await updateDiscardedMessage(chatId, rewindTo);
      }
      saveChatMessages(chatId, messages);
    },
    onError: (error) => {
      logger.error(`用户 ${userId} 的聊天: ${chatId} 处理过程中发生错误 ===> `, error);
      calculateTokenUsage(ChatUsageStatus.FAILED);
      calculateMinorModelTokenUsage(ChatUsageStatus.FAILED);
      return '内部服务器错误，请稍后重试';
    },
  });

  return createUIMessageStreamResponse({ stream, consumeSseStream: consumeStream });
}
