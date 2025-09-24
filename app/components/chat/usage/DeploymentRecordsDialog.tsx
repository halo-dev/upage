import * as RadixDialog from '@radix-ui/react-dialog';
import * as Tooltip from '@radix-ui/react-tooltip';
import classNames from 'classnames';
import { motion, type Transition, type Variants } from 'framer-motion';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { type DeploymentRecord, useDeploymentRecords } from '~/lib/hooks/useDeploymentRecords';
import { DeploymentPlatformEnum, DeploymentStatusEnum } from '~/types/deployment';
import { ConfirmationDialog, DialogDescription, DialogTitle } from '../../ui/Dialog';
import { IconButton } from '../../ui/IconButton';
import { Tabs, TabsList, TabsTrigger } from '../../ui/Tabs';

const transition: Transition = {
  duration: 0.15,
  ease: [0.16, 1, 0.3, 1],
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

interface DeploymentRecordsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DeploymentRecordsDialog = memo(({ isOpen, onClose }: DeploymentRecordsDialogProps) => {
  const {
    deploymentRecords,
    totals,
    stats,
    isLoading,
    isPlatformLoading,
    loadPlatformRecords,
    refreshDeploymentRecords,
    toggleAccess,
    deletePage,
  } = useDeploymentRecords();
  const [activePlatform, setActivePlatform] = useState<DeploymentPlatformEnum>(DeploymentPlatformEnum._1PANEL);
  const [loadedPlatforms, setLoadedPlatforms] = useState<Set<string>>(new Set());
  const initialLoadDone = useRef<boolean>(false);

  // 确认对话框状态
  type ConfirmAction = 'toggle-access' | 'delete';
  type ConfirmDialogState = {
    isOpen: boolean;
    action: ConfirmAction;
    recordId: string | null;
    platform: string | null;
    recordStatus?: string;
  };

  const [confirmDialogState, setConfirmDialogState] = useState<ConfirmDialogState>({
    isOpen: false,
    action: 'toggle-access',
    recordId: null,
    platform: null,
  });

  const [isConfirmationLoading, setIsConfirmationLoading] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const loadMore = useCallback(() => {
    const currentRecords = deploymentRecords[activePlatform] || [];
    loadPlatformRecords({ offset: currentRecords.length, platform: activePlatform });
  }, [activePlatform, deploymentRecords, loadPlatformRecords]);

  const handleTabChange = useCallback(
    (value: string) => {
      const newPlatform = value as DeploymentPlatformEnum;
      setActivePlatform(newPlatform);

      if (!loadedPlatforms.has(newPlatform)) {
        loadPlatformRecords({ platform: newPlatform });
        setLoadedPlatforms((prev) => new Set(prev).add(newPlatform));
      }
    },
    [loadPlatformRecords, loadedPlatforms],
  );

  useEffect(() => {
    if (isOpen && !initialLoadDone.current) {
      refreshDeploymentRecords();
      setLoadedPlatforms((prev) => new Set(prev).add(activePlatform));
      initialLoadDone.current = true;
    }

    if (!isOpen) {
      initialLoadDone.current = false;
    }
  }, [isOpen, activePlatform, refreshDeploymentRecords]);

  const openConfirmDialog = useCallback((action: ConfirmAction, record: DeploymentRecord) => {
    setConfirmDialogState({
      isOpen: true,
      action,
      recordId: record.id,
      platform: record.platform,
      recordStatus: record.status,
    });
  }, []);

  const closeConfirmDialog = useCallback(() => {
    setConfirmDialogState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const handleConfirmAction = useCallback(async () => {
    const { action, recordId, platform } = confirmDialogState;
    if (!recordId || !platform) {
      return;
    }

    setIsConfirmationLoading(true);

    try {
      if (action === 'toggle-access') {
        await toggleAccess(recordId, platform);
      }
      if (action === 'delete') {
        await deletePage(recordId, platform);
      }

      refreshDeploymentRecords();
      closeConfirmDialog();
    } catch (error) {
      console.error('操作失败:', error);
      toast.error('操作失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setIsConfirmationLoading(false);
    }
  }, [confirmDialogState, toggleAccess, deletePage, refreshDeploymentRecords, closeConfirmDialog]);

  const handleToggleAccess = useCallback(
    (record: DeploymentRecord) => {
      openConfirmDialog('toggle-access', record);
    },
    [openConfirmDialog],
  );

  const handleDeletePage = useCallback(
    (record: DeploymentRecord) => {
      openConfirmDialog('delete', record);
    },
    [openConfirmDialog],
  );

  const cardClasses = classNames(
    'p-4 rounded-lg shadow-sm',
    'bg-upage-elements-bg-depth-1',
    'border border-upage-elements-borderColor',
  );

  const platformIcons = {
    [DeploymentPlatformEnum._1PANEL]: 'i-ph:browser',
    [DeploymentPlatformEnum.NETLIFY]: 'i-ph:cloud',
    [DeploymentPlatformEnum.VERCEL]: 'i-ph:triangle',
  };

  // 状态配置类型
  type StatusConfig = {
    text: string;
    bgClass: string;
    dotClass: string;
    icon: string;
  };

  // 部署状态配置
  const deploymentStatusConfig: Record<string, StatusConfig> = {
    [DeploymentStatusEnum.SUCCESS]: {
      text: '已部署',
      bgClass: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      dotClass: 'bg-green-500 dark:bg-green-400',
      icon: 'i-carbon:checkmark-filled',
    },
    [DeploymentStatusEnum.DEPLOYED]: {
      text: '已部署',
      bgClass: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      dotClass: 'bg-green-500 dark:bg-green-400',
      icon: 'i-carbon:checkmark-filled',
    },
    [DeploymentStatusEnum.PENDING]: {
      text: '部署中',
      bgClass: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      dotClass: 'bg-yellow-500 dark:bg-yellow-400',
      icon: 'i-carbon:time',
    },
    [DeploymentStatusEnum.DEPLOYING]: {
      text: '部署中',
      bgClass: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      dotClass: 'bg-yellow-500 dark:bg-yellow-400',
      icon: 'i-carbon:in-progress',
    },
    [DeploymentStatusEnum.FAILED]: {
      text: '失败',
      bgClass: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      dotClass: 'bg-red-500 dark:bg-red-400',
      icon: 'i-carbon:close-filled',
    },
    [DeploymentStatusEnum.INACTIVE]: {
      text: '已停用',
      bgClass: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
      dotClass: 'bg-gray-500 dark:bg-gray-400',
      icon: 'i-carbon:pause-filled',
    },
  };

  // 部署状态徽章组件
  const DeploymentStatusBadge = ({ status }: { status: string }) => {
    // 获取状态配置，如果不存在则使用默认配置
    const config = deploymentStatusConfig[status] || {
      text: status,
      bgClass: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
      dotClass: 'bg-gray-500 dark:bg-gray-400',
      icon: 'i-carbon:help',
    };

    return (
      <span className={classNames('px-2 py-1 text-xs rounded-full inline-flex items-center gap-1', config.bgClass)}>
        <span className={classNames('size-1.5 rounded-full', config.dotClass)} />
        {config.text}
      </span>
    );
  };

  const isActive = useCallback((status: string) => {
    return status === DeploymentStatusEnum.SUCCESS || status === DeploymentStatusEnum.DEPLOYED;
  }, []);

  return (
    <Tooltip.Provider>
      <>
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
                  展示网站部署记录，包括各平台部署的网站数量、运行状态及访问统计等信息。
                </DialogDescription>
                <div className="flex items-center justify-between px-6 py-4 border-b border-upage-elements-borderColor">
                  <DialogTitle>部署记录</DialogTitle>
                  <div className="flex items-center gap-2">
                    <IconButton
                      icon={isLoading ? 'i-ph:spinner-gap-bold animate-spin' : 'i-ph:arrows-clockwise'}
                      onClick={refreshDeploymentRecords}
                      disabled={isLoading}
                      className={classNames(
                        'text-upage-elements-textTertiary hover:text-upage-elements-textSecondary',
                        {
                          'opacity-50 cursor-not-allowed': isLoading,
                        },
                      )}
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
                        <span className="text-upage-elements-textSecondary font-medium">数据加载中...</span>
                      </div>
                    </div>
                  )}

                  <div className="flex-1 overflow-auto p-6">
                    <div className="space-y-8">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className={cardClasses}>
                          <div className="text-sm text-upage-elements-textSecondary mb-1">网站总数</div>
                          <div className="text-2xl font-bold text-upage-elements-textPrimary flex items-center">
                            <span className="i-ph:globe-duotone size-6 text-purple-500 dark:text-purple-400 mr-2" />
                            {stats.totalSites || 0}
                          </div>
                        </div>

                        <div className={cardClasses}>
                          <div className="text-sm text-upage-elements-textSecondary mb-1">累计访问量</div>
                          <div className="text-2xl font-bold text-upage-elements-textPrimary flex items-center">
                            <span className="i-ph:users-duotone size-6 text-blue-500 dark:text-blue-400 mr-2" />
                            {stats.totalVisits.toLocaleString()}
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="text-base font-medium text-upage-elements-textPrimary mb-4 flex items-center">
                          <span className="i-ph:list-checks-duotone size-5 text-purple-500 dark:text-purple-400 mr-2" />
                          部署详情
                        </h3>

                        <Tabs value={activePlatform} onValueChange={handleTabChange} className="mb-4">
                          <TabsList className="w-full border border-upage-elements-borderColor rounded-md p-1 bg-gray-50 dark:bg-gray-900/20 flex">
                            {Object.values(DeploymentPlatformEnum).map((platform, index) => {
                              const count = stats.sitesByPlatform?.[platform] || 0;
                              const isLoading = isPlatformLoading(platform);
                              const isActive = activePlatform === platform;
                              const isLast = index === Object.values(DeploymentPlatformEnum).length - 1;

                              return (
                                <div key={platform} className="flex items-center flex-1">
                                  <TabsTrigger
                                    value={platform}
                                    className={classNames(
                                      'flex-1 relative py-2 px-3 transition-all duration-200',
                                      isActive
                                        ? 'bg-white dark:bg-gray-800 shadow-sm rounded-md text-upage-elements-textPrimary font-medium'
                                        : 'hover:bg-gray-100/70 dark:hover:bg-gray-800/30 text-upage-elements-textSecondary',
                                    )}
                                  >
                                    <div className="flex items-center justify-center gap-2">
                                      <span
                                        className={classNames(
                                          platformIcons[platform],
                                          'size-4',
                                          isActive ? 'text-purple-500 dark:text-purple-400' : '',
                                        )}
                                      />
                                      <span>{platform === DeploymentPlatformEnum._1PANEL ? '1Panel' : platform}</span>
                                      {isLoading ? (
                                        <span className="i-carbon:circle-dash animate-spin size-3 ml-1 text-purple-500 dark:text-purple-400" />
                                      ) : (
                                        <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                                          {count || 0}
                                        </span>
                                      )}
                                    </div>

                                    {isActive && (
                                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500 dark:bg-purple-400 rounded-full mx-4" />
                                    )}
                                  </TabsTrigger>

                                  {!isLast && (
                                    <div className="h-8 w-px bg-upage-elements-borderColor dark:bg-gray-700/50" />
                                  )}
                                </div>
                              );
                            })}
                          </TabsList>
                        </Tabs>

                        <div className={classNames(cardClasses, 'p-0 overflow-hidden')}>
                          <div className="min-h-[400px] max-h-[500px] flex flex-col">
                            <div className="overflow-x-auto h-full relative">
                              <table className="w-full table-fixed">
                                <thead className="bg-gray-50 dark:bg-gray-900/50 sticky top-0 z-10">
                                  <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-upage-elements-textSecondary uppercase tracking-wider w-[15%]">
                                      聊天
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-upage-elements-textSecondary uppercase tracking-wider w-[10%]">
                                      状态
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-upage-elements-textSecondary uppercase tracking-wider w-[25%]">
                                      部署地址
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-upage-elements-textSecondary uppercase tracking-wider w-[15%]">
                                      部署时间
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-upage-elements-textSecondary uppercase tracking-wider w-[15%]">
                                      更新时间
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-upage-elements-textSecondary uppercase tracking-wider w-[20%]">
                                      操作
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-upage-elements-borderColor">
                                  {isPlatformLoading(activePlatform) && !deploymentRecords[activePlatform]?.length ? (
                                    <tr>
                                      <td colSpan={6} className="h-[300px]">
                                        <div className="flex flex-col items-center justify-center h-full">
                                          <div className="i-ph:spinner-gap-bold animate-spin size-8 mb-2 text-purple-500 dark:text-purple-400" />
                                          <span className="text-upage-elements-textSecondary">加载中...</span>
                                        </div>
                                      </td>
                                    </tr>
                                  ) : deploymentRecords[activePlatform]?.length > 0 ? (
                                    deploymentRecords[activePlatform].map((record) => (
                                      <tr
                                        key={record.id}
                                        className="hover:bg-gray-50 dark:hover:bg-gray-900/30 transition-colors duration-150"
                                      >
                                        <td className="px-4 py-3 text-sm">
                                          <a
                                            href={`/chat/${record.chatId}`}
                                            className="text-blue-500 dark:text-blue-400 hover:underline hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
                                            title={record.chat?.description || '未命名聊天'}
                                          >
                                            <div className="flex items-center gap-1">
                                              <span className="i-ph:chat-circle-text size-4 flex-shrink-0" />
                                              <span className="line-clamp-1">
                                                {record.chat?.description || '未命名聊天'}
                                              </span>
                                            </div>
                                          </a>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                          <DeploymentStatusBadge status={record.status} />
                                        </td>
                                        <td className="px-4 py-3 text-sm text-blue-500 dark:text-blue-400 text-ellipsis text-nowrap">
                                          <a
                                            href={record.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="hover:underline flex items-center gap-1"
                                          >
                                            <span className="i-ph:link size-4 flex-shrink-0" />
                                            <span className="line-clamp-1">{record.url}</span>
                                          </a>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-upage-elements-textSecondary whitespace-nowrap">
                                          {formatDate(record.createdAt)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-upage-elements-textSecondary whitespace-nowrap">
                                          {formatDate(record.updatedAt)}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                          <div className="flex items-center space-x-2">
                                            <Tooltip.Root>
                                              <Tooltip.Trigger asChild>
                                                <IconButton
                                                  icon={isActive(record.status) ? 'i-ph:pause-fill' : 'i-ph:play-fill'}
                                                  onClick={() => handleToggleAccess(record)}
                                                  className="!text-gray-500 !hover:text-purple-600 dark:!text-gray-400 dark:!hover:text-purple-400"
                                                />
                                              </Tooltip.Trigger>
                                              <Tooltip.Portal>
                                                <Tooltip.Content
                                                  className="px-2.5 py-1.5 rounded-md bg-upage-elements-background-depth-3 text-upage-elements-textPrimary text-sm z-[2000]"
                                                  sideOffset={5}
                                                  side="top"
                                                >
                                                  {isActive(record.status) ? '停止访问' : '开启访问'}
                                                  <Tooltip.Arrow
                                                    className="fill-upage-elements-background-depth-3"
                                                    width={12}
                                                    height={6}
                                                  />
                                                </Tooltip.Content>
                                              </Tooltip.Portal>
                                            </Tooltip.Root>

                                            <Tooltip.Root>
                                              <Tooltip.Trigger asChild>
                                                <IconButton
                                                  icon="i-ph:pencil-duotone"
                                                  onClick={() => {
                                                    window.open(`/chat/${record.chatId}`);
                                                  }}
                                                  className="!text-gray-500 !hover:text-blue-600 dark:!text-gray-400 dark:!hover:text-blue-400"
                                                />
                                              </Tooltip.Trigger>
                                              <Tooltip.Portal>
                                                <Tooltip.Content
                                                  className="px-2.5 py-1.5 rounded-md bg-upage-elements-background-depth-3 text-upage-elements-textPrimary text-sm z-[2000]"
                                                  sideOffset={5}
                                                  side="top"
                                                >
                                                  编辑页面
                                                  <Tooltip.Arrow
                                                    className="fill-upage-elements-background-depth-3"
                                                    width={12}
                                                    height={6}
                                                  />
                                                </Tooltip.Content>
                                              </Tooltip.Portal>
                                            </Tooltip.Root>

                                            <Tooltip.Root>
                                              <Tooltip.Trigger asChild>
                                                <IconButton
                                                  icon={'i-ph:trash-duotone'}
                                                  onClick={() => handleDeletePage(record)}
                                                  className="!text-gray-500 !hover:text-red-600 dark:!text-gray-400 dark:!hover:text-red-400"
                                                />
                                              </Tooltip.Trigger>
                                              <Tooltip.Portal>
                                                <Tooltip.Content
                                                  className="px-2.5 py-1.5 rounded-md bg-upage-elements-background-depth-3 text-upage-elements-textPrimary text-sm z-[2000]"
                                                  sideOffset={5}
                                                  side="top"
                                                >
                                                  删除页面
                                                  <Tooltip.Arrow
                                                    className="fill-upage-elements-background-depth-3"
                                                    width={12}
                                                    height={6}
                                                  />
                                                </Tooltip.Content>
                                              </Tooltip.Portal>
                                            </Tooltip.Root>
                                          </div>
                                        </td>
                                      </tr>
                                    ))
                                  ) : (
                                    <tr>
                                      <td
                                        colSpan={6}
                                        className="px-4 py-8 h-[300px] text-center text-upage-elements-textSecondary"
                                      >
                                        <div className="flex flex-col items-center justify-center h-full">
                                          <div className="i-ph:cloud-slash-duotone size-8 mb-2 opacity-70" />
                                          <span>暂无部署记录</span>
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>

                        {deploymentRecords[activePlatform]?.length > 0 &&
                          deploymentRecords[activePlatform].length < (totals[activePlatform] || 0) && (
                            <div className="flex justify-center mt-4">
                              <button
                                onClick={loadMore}
                                disabled={isPlatformLoading(activePlatform)}
                                className={classNames(
                                  'flex items-center gap-2 px-4 py-2 rounded-md text-sm',
                                  'text-upage-elements-textSecondary hover:text-upage-elements-textPrimary',
                                  'border border-upage-elements-borderColor hover:border-upage-elements-borderColorHover',
                                  'transition-colors',
                                  { 'opacity-50 cursor-not-allowed': isPlatformLoading(activePlatform) },
                                )}
                              >
                                {isPlatformLoading(activePlatform) ? (
                                  <div className="i-ph:spinner-gap-bold animate-spin size-4" />
                                ) : (
                                  <div className="i-ph:arrow-down size-4" />
                                )}
                                加载更多
                              </button>
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </RadixDialog.Content>
          </RadixDialog.Portal>
        </RadixDialog.Root>

        <ConfirmationDialog
          isOpen={confirmDialogState.isOpen}
          onClose={closeConfirmDialog}
          onConfirm={handleConfirmAction}
          title={
            confirmDialogState.action === 'toggle-access'
              ? `${confirmDialogState.recordStatus === 'inactive' ? '开启' : '停止'}页面访问`
              : '删除页面'
          }
          description={
            confirmDialogState.action === 'toggle-access'
              ? `确定要${confirmDialogState.recordStatus === 'inactive' ? '开启' : '停止'}此页面的访问吗？
              ${confirmDialogState.recordStatus === 'inactive' ? '开启之后，可能需要等待一段时间才可访问。' : ''}
              `
              : '确定要删除此页面吗？此操作不可撤销。'
          }
          confirmLabel={
            confirmDialogState.action === 'toggle-access'
              ? confirmDialogState.recordStatus === 'inactive'
                ? '开启访问'
                : '停止访问'
              : '删除页面'
          }
          cancelLabel="取消"
          variant={confirmDialogState.action === 'delete' ? 'destructive' : 'default'}
          isLoading={isConfirmationLoading}
        />
      </>
    </Tooltip.Provider>
  );
});
