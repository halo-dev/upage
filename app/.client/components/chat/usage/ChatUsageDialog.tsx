import * as RadixDialog from '@radix-ui/react-dialog';
import classNames from 'classnames';
import { motion, type Transition, type Variants } from 'framer-motion';
import { memo } from 'react';
import { useChatUsage } from '~/.client/hooks/useChatUsage';
import { DialogDescription, DialogTitle } from '../../ui/Dialog';
import { IconButton } from '../../ui/IconButton';
import { ChatUsageVisualization } from './ChatUsageVisualization';

const transition: Transition = {
  duration: 0.15,
  ease: [0.16, 1, 0.3, 1], // cubicBezier(.16,1,.3,1)
};

const backdropVariants: Variants = {
  closed: {
    opacity: 0,
    transition,
  },
  open: {
    opacity: 1,
    transition,
  },
};

const dialogVariants: Variants = {
  closed: {
    x: '-50%',
    y: '-40%',
    scale: 0.96,
    opacity: 0,
    transition,
  },
  open: {
    x: '-50%',
    y: '-50%',
    scale: 1,
    opacity: 1,
    transition,
  },
};

interface ChatUsageDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChatUsageDialog = memo(({ isOpen, onClose }: ChatUsageDialogProps) => {
  const { usageStats, isLoading, refreshUsageStats } = useChatUsage();

  const formatNumber = (num: number | null) => {
    if (num === null) {
      return '0';
    }
    return num.toLocaleString();
  };

  const formatLargeNumber = (num: number | null) => {
    if (num === null) {
      return '0';
    }
    if (num < 1000) {
      return num.toString();
    }
    if (num < 1000000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return `${(num / 1000000).toFixed(1)}M`;
  };

  // 计算成功率
  const successRate = () => {
    if (!usageStats) {
      return 0;
    }

    const successCount = usageStats.byStatus.find((s) => s.status === 'SUCCESS')?._count || 0;
    const totalCount = usageStats.total._count;

    return totalCount > 0 ? (successCount / totalCount) * 100 : 0;
  };

  // 计算平均 token 消耗
  const avgTokenPerRequest = () => {
    if (!usageStats || usageStats.total._count === 0) {
      return 0;
    }
    return (usageStats.total._sum.totalTokens || 0) / usageStats.total._count;
  };

  const cardClasses = classNames(
    'p-4 rounded-lg shadow-sm',
    'bg-upage-elements-bg-depth-1',
    'border border-upage-elements-borderColor',
  );

  return (
    <RadixDialog.Root open={isOpen} onOpenChange={onClose}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay asChild>
          <motion.div
            className={classNames('fixed inset-0 z-[9999] bg-black/70 dark:bg-black/80 backdrop-blur-sm')}
            initial="closed"
            animate="open"
            exit="closed"
            variants={backdropVariants}
          />
        </RadixDialog.Overlay>

        <RadixDialog.Content asChild>
          <motion.div
            className={classNames(
              'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-950 rounded-lg shadow-xl border border-upage-elements-borderColor z-[9999] w-[95vw] max-w-[1000px] max-h-[85vh] flex flex-col',
            )}
            initial="closed"
            animate="open"
            exit="closed"
            variants={dialogVariants}
          >
            <DialogDescription className="sr-only">
              用于展示 API 使用情况统计数据，包括请求次数、Token 用量及成功率等信息。
            </DialogDescription>
            <div className="flex items-center justify-between px-6 py-4 border-b border-upage-elements-borderColor">
              <DialogTitle>API 使用统计</DialogTitle>
              <div className="flex items-center gap-2">
                <IconButton
                  icon={isLoading ? 'i-ph:spinner-gap-bold animate-spin' : 'i-ph:arrows-clockwise'}
                  onClick={refreshUsageStats}
                  disabled={isLoading}
                  className={classNames('text-upage-elements-textTertiary hover:text-upage-elements-textSecondary', {
                    'opacity-50 cursor-not-allowed': isLoading,
                  })}
                  aria-label="刷新统计数据"
                  title="刷新统计数据"
                />
                <RadixDialog.Close asChild onClick={onClose}>
                  <IconButton
                    icon="i-ph:x"
                    className="text-upage-elements-textTertiary hover:text-upage-elements-textSecondary"
                  />
                </RadixDialog.Close>
              </div>
            </div>

            <div className="flex-1 overflow-auto relative">
              {isLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 dark:bg-gray-950/70 backdrop-blur-sm">
                  <div className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white/90 dark:bg-gray-900/90 shadow-sm">
                    <div className="i-ph:spinner-gap-bold animate-spin size-5 text-upage-elements-textTertiary" />
                    <span className="text-upage-elements-textSecondary font-medium">数据刷新中...</span>
                  </div>
                </div>
              )}

              {!usageStats ? (
                <div className="flex-1 overflow-auto text-center py-12">
                  <div className="i-ph:chart-line-duotone size-12 mx-auto mb-4 text-upage-elements-textTertiary opacity-80" />
                  <h3 className="text-lg font-medium text-upage-elements-textPrimary mb-2">暂无数据</h3>
                  <p className="text-upage-elements-textSecondary">还没有使用记录，开始使用 AI 功能来生成数据统计。</p>
                </div>
              ) : (
                <div className="flex-1 overflow-auto p-6">
                  <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className={cardClasses}>
                        <div className="text-sm text-upage-elements-textSecondary mb-1">总请求次数</div>
                        <div className="text-2xl font-bold text-upage-elements-textPrimary flex items-center">
                          <span className="i-ph:chat-dots-duotone size-6 text-purple-500 dark:text-purple-400 mr-2" />
                          {formatNumber(usageStats.total._count)}
                        </div>
                      </div>

                      <div className={cardClasses}>
                        <div className="text-sm text-upage-elements-textSecondary mb-1">总 Token 用量</div>
                        <div className="text-2xl font-bold text-upage-elements-textPrimary flex items-center">
                          <span className="i-ph:hash-duotone size-6 text-green-500 dark:text-green-400 mr-2" />
                          {formatLargeNumber(usageStats.total._sum.totalTokens)}
                        </div>
                      </div>

                      <div className={cardClasses}>
                        <div className="text-sm text-upage-elements-textSecondary mb-1">输入 Token</div>
                        <div className="text-2xl font-bold text-upage-elements-textPrimary flex items-center">
                          <span className="i-ph:export-duotone size-6 text-blue-500 dark:text-blue-400 mr-2" />
                          {formatLargeNumber(usageStats.total._sum.inputTokens)}
                        </div>
                      </div>

                      <div className={cardClasses}>
                        <div className="text-sm text-upage-elements-textSecondary mb-1">输出 Token</div>
                        <div className="text-2xl font-bold text-upage-elements-textPrimary flex items-center">
                          <span className="i-bx:import size-6 text-amber-500 dark:text-amber-400 mr-2" />
                          {formatLargeNumber(usageStats.total._sum.outputTokens)}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className={cardClasses}>
                        <h3 className="text-base font-medium text-upage-elements-textPrimary mb-3 flex items-center">
                          <span className="i-ph:chart-pie-slice-duotone size-5 text-purple-500 dark:text-purple-400 mr-2" />
                          请求成功率
                        </h3>
                        <div className="mt-4">
                          <div className="flex justify-between items-center mb-2">
                            <div className="text-3xl font-bold text-upage-elements-textPrimary">
                              {successRate().toFixed(1)}%
                            </div>
                            <div className="text-sm text-upage-elements-textSecondary">
                              {usageStats.byStatus.find((s) => s.status === 'SUCCESS')?._count || 0} /{' '}
                              {usageStats.total._count}
                            </div>
                          </div>
                          <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 dark:bg-green-400 rounded-full"
                              style={{ width: `${Math.min(100, successRate())}%` }}
                            />
                          </div>
                        </div>

                        <div className="mt-4 space-y-2">
                          {usageStats.byStatus.map((status) => (
                            <div key={status.status} className="flex justify-between items-center">
                              <div className="flex items-center">
                                <div
                                  className={classNames('size-2 rounded-full mr-2', {
                                    'bg-green-500 dark:bg-green-400': status.status === 'SUCCESS',
                                    'bg-red-500 dark:bg-red-400': status.status === 'FAILED',
                                    'bg-yellow-500 dark:bg-yellow-400': status.status === 'PENDING',
                                    'bg-gray-500 dark:bg-gray-400': !['SUCCESS', 'FAILED', 'PENDING'].includes(
                                      status.status,
                                    ),
                                  })}
                                />
                                <div className="text-sm text-upage-elements-textSecondary capitalize">
                                  {status.status === 'SUCCESS'
                                    ? '成功'
                                    : status.status === 'FAILED'
                                      ? '失败'
                                      : status.status === 'PENDING'
                                        ? '处理中'
                                        : status.status === 'ABORTED'
                                          ? '中止'
                                          : status.status}
                                </div>
                              </div>
                              <div className="text-sm font-medium text-upage-elements-textPrimary">
                                {formatNumber(status._count)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className={cardClasses}>
                        <h3 className="text-base font-medium text-upage-elements-textPrimary mb-3 flex items-center">
                          <span className="i-ph:check-circle-duotone size-5 text-green-500 dark:text-green-400 mr-2" />
                          Token 消耗统计
                        </h3>

                        <div className="space-y-4">
                          <div>
                            <div className="text-sm text-upage-elements-textSecondary mb-1">平均每次请求消耗</div>
                            <div className="text-2xl font-bold text-upage-elements-textPrimary">
                              {formatLargeNumber(avgTokenPerRequest())} Tokens
                            </div>
                          </div>

                          <div className="pt-2 border-t border-upage-elements-borderColor">
                            <div className="text-sm text-upage-elements-textSecondary mb-2">Token 类型分布</div>
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <div className="text-sm text-upage-elements-textSecondary flex items-center">
                                  <div className="size-2 rounded-full bg-blue-500 dark:bg-blue-400 mr-2" />
                                  输入 Token
                                </div>
                                <div className="text-sm font-medium text-upage-elements-textPrimary">
                                  {formatLargeNumber(usageStats.total._sum.inputTokens)}
                                  <span className="text-xs text-upage-elements-textTertiary ml-1">
                                    (
                                    {usageStats.total._sum.totalTokens
                                      ? (
                                          ((usageStats.total._sum.inputTokens || 0) /
                                            usageStats.total._sum.totalTokens) *
                                          100
                                        ).toFixed(0)
                                      : 0}
                                    %)
                                  </span>
                                </div>
                              </div>

                              <div className="flex justify-between">
                                <div className="text-sm text-upage-elements-textSecondary flex items-center">
                                  <div className="size-2 rounded-full bg-amber-500 dark:bg-amber-400 mr-2" />
                                  输出 Token
                                </div>
                                <div className="text-sm font-medium text-upage-elements-textPrimary">
                                  {formatLargeNumber(usageStats.total._sum.outputTokens)}
                                  <span className="text-xs text-upage-elements-textTertiary ml-1">
                                    (
                                    {usageStats.total._sum.totalTokens
                                      ? (
                                          ((usageStats.total._sum.outputTokens || 0) /
                                            usageStats.total._sum.totalTokens) *
                                          100
                                        ).toFixed(0)
                                      : 0}
                                    %)
                                  </span>
                                </div>
                              </div>

                              <div className="flex justify-between">
                                <div className="text-sm text-upage-elements-textSecondary flex items-center">
                                  <div className="size-2 rounded-full bg-green-500 dark:bg-green-400 mr-2" />
                                  缓存 Token
                                </div>
                                <div className="text-sm font-medium text-upage-elements-textPrimary">
                                  {formatLargeNumber(usageStats.total._sum.cachedTokens)}
                                  <span className="text-xs text-upage-elements-textTertiary ml-1">
                                    (
                                    {usageStats.total._sum.totalTokens
                                      ? (
                                          ((usageStats.total._sum.cachedTokens || 0) /
                                            usageStats.total._sum.totalTokens) *
                                          100
                                        ).toFixed(0)
                                      : 0}
                                    %)
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className={cardClasses}>
                        <h3 className="text-base font-medium text-upage-elements-textPrimary mb-3 flex items-center">
                          <span className="i-ph:trend-up-duotone size-5 text-blue-500 dark:text-blue-400 mr-2" />
                          使用趋势
                        </h3>
                        <div className="space-y-4">
                          {usageStats.byDate.length > 0 ? (
                            <>
                              <div>
                                <div className="text-sm text-upage-elements-textSecondary mb-1">今日请求</div>
                                <div className="text-2xl font-bold text-upage-elements-textPrimary">
                                  {usageStats.byDate.length > 0
                                    ? formatNumber(usageStats.byDate[usageStats.byDate.length - 1].count)
                                    : '0'}
                                </div>
                              </div>

                              <div className="pt-2 border-t border-upage-elements-borderColor">
                                <div className="text-sm text-upage-elements-textSecondary mb-2">最近趋势</div>
                                <div className="text-sm text-upage-elements-textTertiary">
                                  {usageStats.byDate.length > 1 ? (
                                    (() => {
                                      const current = usageStats.byDate[usageStats.byDate.length - 1].count;
                                      const previous = usageStats.byDate[usageStats.byDate.length - 2].count;
                                      const diff = current - previous;
                                      const percentage = previous !== 0 ? (diff / previous) * 100 : 0;

                                      return (
                                        <div className="flex items-center">
                                          <span className="text-upage-elements-textSecondary">较前一日:</span>
                                          <span
                                            className={classNames('ml-1 flex items-center', {
                                              'text-green-500 dark:text-green-400': diff > 0,
                                              'text-red-500 dark:text-red-400': diff < 0,
                                              'text-upage-elements-textTertiary': diff === 0,
                                            })}
                                          >
                                            {diff > 0 ? (
                                              <span className="i-ph:arrow-up size-3.5 mr-0.5"></span>
                                            ) : diff < 0 ? (
                                              <span className="i-ph:arrow-down size-3.5 mr-0.5"></span>
                                            ) : (
                                              <span className="i-ph:minus size-3.5 mr-0.5"></span>
                                            )}
                                            {Math.abs(percentage).toFixed(0)}%
                                          </span>
                                        </div>
                                      );
                                    })()
                                  ) : (
                                    <span>尚无对比数据</span>
                                  )}
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="flex items-center justify-center h-full py-6">
                              <span className="text-sm text-upage-elements-textSecondary">暂无数据</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className={classNames(cardClasses, 'p-0 overflow-hidden')}>
                      <div className="p-4 border-b border-upage-elements-borderColor">
                        <h3 className="text-base font-medium text-upage-elements-textPrimary flex items-center">
                          <span className="i-ph:chart-line-up-duotone size-5 text-purple-500 dark:text-purple-400 mr-2" />
                          使用统计图表
                        </h3>
                      </div>
                      <div className="p-4">
                        <ChatUsageVisualization usageStats={usageStats} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
});
