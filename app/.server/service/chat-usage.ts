import { prisma } from '~/.server/service/prisma';
import { createScopedLogger } from '~/.server/utils/logger';

const logger = createScopedLogger('chatUsage.server');

/**
 * 聊天使用量状态
 */
export enum ChatUsageStatus {
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  PENDING = 'PENDING',
  ABORTED = 'ABORTED',
}

/**
 * 聊天使用量记录参数接口
 */
export interface ChatUsageParams {
  userId: string;
  chatId: string;
  messageId: string;
  status: ChatUsageStatus;
  inputTokens?: number;
  outputTokens?: number;
  cachedTokens?: number;
  reasoningTokens?: number;
  totalTokens?: number;
  modelName?: string;
  prompt?: string;
  metadata?: Record<string, any>;
}
/**
 * 日期过滤器类型
 */
interface DateFilter {
  calledAt?: {
    gte?: Date;
    lte?: Date;
  };
}

/**
 * 记录聊天使用量
 * @param params 使用量参数
 * @returns 创建的记录
 */
export async function recordUsage(params: ChatUsageParams) {
  const {
    userId,
    chatId,
    messageId,
    inputTokens = 0,
    outputTokens = 0,
    cachedTokens = 0,
    reasoningTokens = 0,
    status,
    prompt,
    metadata,
    modelName,
  } = params;

  // 计算总token量
  const totalTokens = inputTokens + outputTokens;

  try {
    // 创建记录
    const record = await prisma.chatUsage.create({
      data: {
        userId,
        messageId,
        chatId,
        inputTokens,
        outputTokens,
        cachedTokens,
        reasoningTokens,
        totalTokens,
        status,
        prompt,
        metadata,
        modelName,
      },
    });

    if (status === ChatUsageStatus.PENDING) {
      logger.info(`初始化用户 ${userId} 的 ${modelName} 模型聊天使用量`);
    } else {
      logger.info(`记录了用户 ${userId} 的 ${modelName} 模型聊天使用量: ${totalTokens} tokens，状态: ${status}`);
    }
    return record;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`记录聊天使用量失败: ${errorMessage}`);
    throw error;
  }
}

/**
 * 获取按天统计的使用数据
 * @param userId 用户ID
 * @param days 天数，默认为30天
 * @returns 每日使用统计数据
 */
export async function getDailyUsageStats(userId: string, days = 30) {
  try {
    // 计算结束日期为今天（当天结束）
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);

    // 计算开始日期为 endDate 前推 days-1 天的开始时间
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);

    const records = await prisma.chatUsage.findMany({
      where: {
        userId,
        calledAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        calledAt: true,
        totalTokens: true,
      },
    });

    const dateMap: Record<string, { count: number; totalTokens: number }> = {};

    // 创建从startDate到endDate的每一天映射
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      dateMap[dateStr] = { count: 0, totalTokens: 0 };

      // 增加一天
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // 统计数据
    records.forEach((record) => {
      const dateStr = record.calledAt.toISOString().split('T')[0];

      if (dateMap[dateStr]) {
        dateMap[dateStr].count += 1;
        dateMap[dateStr].totalTokens += record.totalTokens;
      }
    });

    return Object.entries(dateMap).map(([date, stats]) => ({
      date,
      count: stats.count,
      totalTokens: stats.totalTokens,
    }));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`获取每日使用统计失败: ${errorMessage}`);
    throw error;
  }
}

/**
 * 获取用户的聊天使用统计
 * @param userId 用户ID
 * @param startDate 开始日期
 * @param endDate 结束日期
 * @returns 使用统计数据
 */
export async function getUserUsageStats(userId: string, startDate?: Date, endDate?: Date) {
  const dateFilter: DateFilter = {};

  if (startDate || endDate) {
    dateFilter.calledAt = {};

    if (startDate) {
      dateFilter.calledAt.gte = startDate;
    }

    if (endDate) {
      dateFilter.calledAt.lte = endDate;
    }
  }

  try {
    // 获取总体使用量
    const stats = await prisma.chatUsage.aggregate({
      where: {
        userId,
        ...dateFilter,
      },
      _sum: {
        inputTokens: true,
        outputTokens: true,
        cachedTokens: true,
        reasoningTokens: true,
        totalTokens: true,
      },
      _count: true,
    });

    // 按状态分组
    const statusStats = await prisma.chatUsage.groupBy({
      by: ['status'],
      where: {
        userId,
        ...dateFilter,
      },
      _count: true,
      _sum: {
        totalTokens: true,
      },
    });

    // 按聊天分组
    const chatStats = await prisma.chatUsage.groupBy({
      by: ['chatId'],
      where: {
        userId,
        ...dateFilter,
      },
      _sum: {
        totalTokens: true,
      },
      _count: true,
    });

    // 获取按天统计的数据
    const dailyStats = await getDailyUsageStats(userId, 7);

    return {
      total: stats,
      byStatus: statusStats,
      byChat: chatStats,
      byDate: dailyStats,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`获取用户使用统计失败: ${errorMessage}`);
    throw error;
  }
}

/**
 * 更新使用记录的状态
 * @param id 记录ID
 * @param status 新状态
 * @param additionalData 额外要更新的数据
 * @returns 更新后的记录
 */
export async function updateUsageStatus(
  id: string,
  status: ChatUsageStatus,
  additionalData?: Partial<ChatUsageParams>,
) {
  try {
    const updatedRecord = await prisma.chatUsage.update({
      where: { id },
      data: {
        status,
        ...additionalData,
      },
    });

    return updatedRecord;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`更新使用记录状态失败: ${errorMessage}`);
    throw error;
  }
}

export async function updateUsageError(id: string, error: string, additionalData?: Partial<ChatUsageParams>) {
  return updateUsageStatus(id, ChatUsageStatus.FAILED, {
    ...additionalData,
    metadata: {
      error: error || '未知错误',
    } as unknown as Record<string, any>,
  });
}

/**
 * 获取最近的使用记录
 * @param userId 用户ID
 * @param limit 限制返回记录数量
 * @returns 使用记录列表
 */
export async function getRecentUsage(userId: string, limit = 10) {
  try {
    const records = await prisma.chatUsage.findMany({
      where: {
        userId,
      },
      orderBy: {
        calledAt: 'desc',
      },
      take: limit,
    });

    return records;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    logger.error(`获取最近使用记录失败: ${errorMessage}`);
    throw error;
  }
}
