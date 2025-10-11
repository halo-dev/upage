import { useRevalidator, useRouteLoaderData } from '@remix-run/react';
import { useState } from 'react';
import { useAuth } from './useAuth';

/**
 * 聊天使用量统计类型定义
 */
export interface ChatUsageStats {
  total: {
    _sum: {
      inputTokens: number | null;
      outputTokens: number | null;
      cachedTokens: number | null;
      totalTokens: number | null;
    };
    _count: number;
  };
  byStatus: Array<{
    status: string;
    _count: number;
    _sum: {
      totalTokens: number | null;
    };
  }>;
  byChat: Array<{
    chatId: string;
    _count: number;
    _sum: {
      totalTokens: number | null;
    };
  }>;
  byDate: Array<{
    date: string;
    count: number;
    totalTokens: number;
  }>;
}

/**
 * useChatUsage Hook - 获取用户聊天使用量统计
 */
export function useChatUsage() {
  const rootData = useRouteLoaderData<{ chatUsage?: ChatUsageStats }>('root');
  const { isAuthenticated } = useAuth();
  const revalidator = useRevalidator();

  const usageStats = isAuthenticated ? rootData?.chatUsage || null : null;
  const [isLoading, setIsLoading] = useState<boolean>(false);

  /**
   * 刷新聊天使用统计数据
   * 通过 Remix 的 revalidator 重新验证根路由数据
   */
  const refreshUsageStats = () => {
    setIsLoading(true);
    revalidator.revalidate();
    setIsLoading(revalidator.state === 'loading');
  };

  // 当 revalidator 状态变化时更新 loading 状态
  if (revalidator.state === 'idle' && isLoading) {
    setIsLoading(false);
  }

  return {
    usageStats,
    isLoading: isLoading || revalidator.state === 'loading',
    refreshUsageStats,
  };
}
