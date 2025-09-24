import { useStore } from '@nanostores/react';
import { useFetcher, useRouteLoaderData } from '@remix-run/react';
import classNames from 'classnames';
import { format, formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale/zh-CN';
import { motion } from 'framer-motion';
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '~/components/ui/Badge';
import { Button } from '~/components/ui/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/Collapsible';
import { _1PanelConnectionStore, fetch1PanelStats, isFetchingStats, update1PanelConnection } from '~/lib/stores/1panel';
import { getChatId } from '~/lib/stores/ai-state';
import type { ConnectionSettings } from '~/root';
import type { _1PanelWebsite } from '~/types/1panel';
import type { ApiResponse } from '~/types/global';
import ConnectionBorder from './components/ConnectionBorder';

export default function _1PanelConnection({
  isDeploying,
  onDeploy,
}: {
  isDeploying: boolean;
  onDeploy: (siteId: number) => void;
}) {
  const rootData = useRouteLoaderData<{ connectionSettings?: ConnectionSettings }>('root');
  const connectFetcher = useFetcher<ApiResponse>();
  const settingsFetcher = useFetcher<ApiResponse>();

  const connection = useStore(_1PanelConnectionStore);
  const [serverUrl, setServerUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const fetching = useStore(isFetchingStats);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [activeSiteIndex, setActiveSiteIndex] = useState(-1);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // 使用 useMemo 计算 isConnecting 状态
  const isConnecting = useMemo(() => {
    return connectFetcher.state !== 'idle';
  }, [connectFetcher.state]);

  useEffect(() => {
    update1PanelConnection({
      isConnect: rootData?.connectionSettings?._1PanelConnection,
    });
  }, [rootData]);

  useEffect(() => {
    if (connection.isConnect) {
      fetch1PanelStats();
    }
  }, [connection.isConnect]);

  // 监听 connectFetcher 状态变化（连接）
  useEffect(() => {
    const data = connectFetcher.data as ApiResponse<{
      websites: _1PanelWebsite[];
      totalWebsites: number;
      lastUpdated: string;
    }>;
    if (connectFetcher.state === 'idle' && data) {
      if (data.success) {
        update1PanelConnection({
          isConnect: true,
          stats: data.data,
          serverUrl,
        });
        toast.success('连接 1Panel 成功');
      } else if (data.message) {
        toast.error(`连接 1Panel 失败: ${data.message}`);
      }
    }
  }, [connectFetcher.state, connectFetcher.data, serverUrl]);

  // 监听 settingsFetcher 状态变化（断开连接）
  useEffect(() => {
    if (settingsFetcher.state === 'idle' && settingsFetcher.data) {
      if (settingsFetcher.data.success) {
        update1PanelConnection({ isConnect: false, serverUrl: '' });
        toast.success('断开 1Panel 服务器连接');
      }
    }
  }, [settingsFetcher.state, settingsFetcher.data]);

  const handleConnect = async (event: React.FormEvent) => {
    if (!serverUrl) {
      toast.error('请填写服务器地址');
      return;
    }
    if (!apiKey) {
      toast.error('请输入 API 密钥');
      return;
    }

    event.preventDefault();

    try {
      connectFetcher.submit(
        { serverUrl, apiKey },
        {
          method: 'POST',
          action: '/api/1panel/auth',
          encType: 'application/json',
        },
      );
    } catch (error) {
      toast.error(`连接 1Panel 失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleDisconnect = async () => {
    try {
      settingsFetcher.submit(
        {
          category: 'connectivity',
          key: '1panel_server_url',
        },
        {
          method: 'DELETE',
          action: '/api/user/settings',
          encType: 'application/json',
        },
      );

      await fetch('/api/user/settings', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          category: 'connectivity',
          key: '1panel_api_key',
        }),
      });
    } catch (error) {
      toast.error('断开 1Panel 连接失败');
      console.error('断开 1Panel 连接失败:', error);
    }
  };

  const handleDeleteWebsite = async (e: React.MouseEvent<HTMLButtonElement>, site: _1PanelWebsite) => {
    e.stopPropagation();

    if (!confirm(`您确定要删除站点 ${site.alias} 吗?`)) {
      return;
    }

    setIsActionLoading(true);
    try {
      const response = await fetch('/api/1panel/websites', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteId: site.id,
        }),
      });

      const { success, message } = (await response.json()) as ApiResponse;

      if (!response.ok || !success) {
        toast.error(`删除站点失败: ${message}`);
        return;
      }

      toast.success(message || '站点删除成功');
      const currentSiteId = localStorage.getItem(`1panel-project-${getChatId()}`);
      if (currentSiteId === site.id.toString()) {
        localStorage.removeItem(`1panel-project-${getChatId()}`);
      }
      fetch1PanelStats();
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : '未知错误';
      toast.error(`删除站点失败: ${error}`);
    }
    setIsActionLoading(false);
  };

  const handleDeployToSite = (e: React.MouseEvent<HTMLButtonElement>, site: _1PanelWebsite) => {
    e.stopPropagation();

    onDeploy(site.id);
  };

  const formatExpirationDate = (date: string) => {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      return '未知';
    }
    // 将日期格式化为 YYYY-MM-DD
    const formattedDate = format(dateObj, 'yyyy-MM-dd');
    if (formattedDate === '9999-12-31') {
      return '永不过期';
    }
    return formattedDate;
  };

  const renderStats = () => {
    if (!connection.isConnect || !connection.stats) {
      return null;
    }

    return (
      <div className="mt-6">
        <Collapsible open={isStatsOpen} onOpenChange={setIsStatsOpen}>
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between p-4 rounded-lg bg-upage-elements-background dark:bg-upage-elements-background-depth-2 border border-upage-elements-borderColor dark:border-upage-elements-borderColor hover:border-upage-elements-borderColorActive/70 dark:hover:border-upage-elements-borderColorActive/70 transition-all duration-200">
              <div className="flex items-center gap-2">
                <div className="i-ph:chart-bar size-4 text-upage-elements-item-contentAccent dark:text-upage-elements-item-contentAccent" />
                <span className="text-sm font-medium text-upage-elements-textPrimary dark:text-upage-elements-textPrimary">
                  1Panel 统计信息
                </span>
              </div>
              <div
                className={classNames(
                  'i-ph:caret-down size-4 transform transition-transform duration-200 text-upage-elements-textSecondary',
                  isStatsOpen ? 'rotate-180' : '',
                )}
              />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent className="overflow-hidden">
            <div className="space-y-4 mt-4">
              <div className="flex flex-wrap items-center gap-4">
                <Badge
                  variant="outline"
                  className="flex items-center gap-1 text-upage-elements-textPrimary dark:text-upage-elements-textPrimary"
                >
                  <div className="heroicons:building-library size-4 text-upage-elements-item-contentAccent" />
                  <span>{connection.stats.totalWebsites} 站点</span>
                </Badge>
                {connection.stats.lastUpdated && (
                  <Badge
                    variant="outline"
                    className="flex items-center gap-1 text-upage-elements-textPrimary dark:text-upage-elements-textPrimary"
                  >
                    <div className="i-lucide:clock size-4 text-upage-elements-item-contentAccent" />
                    <span>
                      更新于 {formatDistanceToNow(new Date(connection.stats.lastUpdated), { locale: zhCN })} 前
                    </span>
                  </Badge>
                )}
              </div>
              {connection.stats.websites.length > 0 && (
                <div className="mt-4 space-y-4">
                  <div className="bg-upage-elements-background dark:bg-upage-elements-background-depth-1 border border-upage-elements-borderColor dark:border-upage-elements-borderColor rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-sm font-medium flex items-center gap-2 text-upage-elements-textPrimary dark:text-upage-elements-textPrimary">
                        <div className="heroicons:building-library size-4 text-upage-elements-item-contentAccent dark:text-upage-elements-item-contentAccent" />
                        您的站点
                      </h4>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fetch1PanelStats()}
                        disabled={fetching}
                        className="flex items-center gap-2 text-upage-elements-textPrimary dark:text-upage-elements-textPrimary hover:bg-upage-elements-item-backgroundActive/10"
                      >
                        <div
                          className={classNames(
                            'heroicons:arrow-path size-4 text-upage-elements-item-contentAccent dark:text-upage-elements-item-contentAccent',
                            { 'animate-spin': fetching },
                          )}
                        />
                        {fetching ? '刷新中...' : '刷新'}
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {connection.stats.websites.map((site, index) => (
                        <div
                          key={site.id}
                          className={classNames(
                            'bg-upage-elements-background dark:bg-upage-elements-background-depth-1 border rounded-lg p-4 transition-all',
                            activeSiteIndex === index
                              ? 'border-upage-elements-item-contentAccent bg-upage-elements-item-backgroundActive/10'
                              : 'border-upage-elements-borderColor hover:border-upage-elements-borderColorActive/70',
                          )}
                          onClick={() => {
                            if (activeSiteIndex === index) {
                              setActiveSiteIndex(-1);
                            } else {
                              setActiveSiteIndex(index);
                            }
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="heroicons:globe-alt size-5 text-upage-elements-item-contentAccent dark:text-upage-elements-item-contentAccent" />
                              <span className="font-medium text-upage-elements-textPrimary dark:text-upage-elements-textPrimary">
                                {site.alias}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={site.status === 'Running' ? 'default' : 'destructive'}
                                className="flex items-center gap-1 text-upage-elements-textPrimary dark:text-upage-elements-textPrimary"
                              >
                                {site.status === 'Running' ? (
                                  <div className="i-lucide:check-circle size-4 text-green-500" />
                                ) : (
                                  <div className="i-lucide:x-circle size-4 text-red-500" />
                                )}
                                <span className="text-upage-elements-textPrimary dark:text-upage-elements-textPrimary">
                                  {site.status === 'Running' ? '已启动' : '已停止'}
                                </span>
                              </Badge>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-col gap-2">
                            {site.domains.map((domain) => (
                              <a
                                key={domain.id}
                                href={`${site.protocol.toLowerCase()}://${domain.domain}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm flex items-center gap-1 transition-colors text-upage-elements-link-text hover:text-upage-elements-link-textHover dark:text-white dark:hover:text-upage-elements-link-textHover w-fit"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="heroicons:paper-airplane size-3 text-upage-elements-item-contentAccent dark:text-upage-elements-item-contentAccent" />
                                <span className="underline decoration-1 underline-offset-2">
                                  {`${site.protocol.toLowerCase()}://${domain.domain}`}
                                </span>
                              </a>
                            ))}
                            <div className="flex items-center gap-2 mt-1">
                              {(() => {
                                const typeInfo = getWebsiteTypeInfo(site.type);
                                return (
                                  <Badge
                                    variant="secondary"
                                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md ${typeInfo.color}`}
                                  >
                                    <div className={`${typeInfo.icon} size-3`} />
                                    <span>{typeInfo.label}</span>
                                  </Badge>
                                );
                              })()}
                              {activeSiteIndex === index && (
                                <div className="flex gap-4 text-sm text-gray-700">
                                  <div className="flex items-center gap-1">
                                    <div className="i-lucide:clock size-4 text-upage-elements-item-contentAccent dark:text-upage-elements-item-contentAccent" />
                                    <span className="text-upage-elements-textSecondary dark:text-upage-elements-textSecondary">
                                      创建于{' '}
                                      <span className="text-upage-elements-textPrimary dark:text-upage-elements-textPrimary">
                                        {formatDistanceToNow(new Date(site.createdAt), { locale: zhCN })}
                                      </span>{' '}
                                      前
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <div className="i-pajamas:expire size-3 text-upage-elements-item-contentAccent dark:text-upage-elements-item-contentAccent"></div>
                                    <span className="text-upage-elements-textSecondary dark:text-upage-elements-textSecondary">
                                      过期时间:{' '}
                                      <span className="text-upage-elements-textPrimary dark:text-upage-elements-textPrimary">
                                        {formatExpirationDate(site.expireDate)}
                                      </span>
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                          {activeSiteIndex === index && (
                            <>
                              <div className="mt-4 pt-3 border-t border-upage-elements-borderColor"></div>
                              <div className="text-sm flex justify-end">
                                <div>
                                  <div className="flex items-center gap-2">
                                    {site.type === 'static' && (
                                      <motion.button
                                        onClick={(e) => handleDeployToSite(e, site)}
                                        disabled={isDeploying}
                                        className="px-4 py-2 rounded-lg h-8 bg-black dark:bg-white dark:text-black text-white text-sm hover:bg-gray-800 dark:hover:bg-gray-200 inline-flex items-center gap-2"
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                      >
                                        {isDeploying ? (
                                          <>
                                            <div className="i-ph:spinner-gap animate-spin size-4" />
                                            部署中...
                                          </>
                                        ) : (
                                          <>
                                            <div className="i-ph:rocket-launch size-4" />
                                            部署到此网站
                                          </>
                                        )}
                                      </motion.button>
                                    )}
                                    <Button
                                      key="delete"
                                      variant="destructive"
                                      size="sm"
                                      onClick={(e) => handleDeleteWebsite(e, site)}
                                      disabled={isActionLoading}
                                      className="flex items-center gap-1 text-upage-elements-textPrimary dark:text-upage-elements-textPrimary"
                                    >
                                      <div className="i-lucide:trash size-4 text-white text-upage-elements-textPrimary dark:text-upage-elements-textPrimary" />
                                      删除网站
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    );
  };

  // 根据网站类型返回对应的标签信息
  const getWebsiteTypeInfo = (type: string) => {
    switch (type) {
      case 'deployment':
        return {
          label: '一键部署',
          icon: 'i-ph:rocket-launch',
          color: 'bg-blue-100 text-blue-700 dark:bg-blue-800/30 dark:text-blue-300',
        };
      case 'runtime':
        return {
          label: '运行环境',
          icon: 'i-ph:code',
          color: 'bg-green-100 text-green-700 dark:bg-green-800/30 dark:text-green-300',
        };
      case 'proxy':
        return {
          label: '反向代理',
          icon: 'i-ph:arrows-left-right',
          color: 'bg-purple-100 text-purple-700 dark:bg-purple-800/30 dark:text-purple-300',
        };
      case 'static':
        return {
          label: '静态网站',
          icon: 'i-ph:file-html',
          color: 'bg-orange-100 text-orange-700 dark:bg-orange-800/30 dark:text-orange-300',
        };
      case 'subsite':
        return {
          label: '子网站',
          icon: 'i-ph:tree-structure',
          color: 'bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-300',
        };
      default:
        return {
          label: '未知类型',
          icon: 'i-ph:question',
          color: 'bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-300',
        };
    }
  };

  return (
    <ConnectionBorder>
      {!connection.isConnect ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-upage-elements-textSecondary mb-2">服务器地址</label>
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              disabled={fetching}
              placeholder="https://your-1panel-server.com"
              className={classNames(
                'w-full px-3 py-2 rounded-lg text-sm',
                'bg-[#F8F8F8] dark:bg-[#1A1A1A]',
                'border border-[#E5E5E5] dark:border-[#333333]',
                'text-upage-elements-textPrimary placeholder-upage-elements-textTertiary',
                'focus:outline-none focus:ring-1 focus:ring-upage-elements-borderColorActive',
                'disabled:opacity-50',
              )}
            />
          </div>

          <div>
            <label className="block text-sm text-upage-elements-textSecondary mb-2">API 密钥</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={fetching}
              placeholder="请输入您的 API 密钥"
              className={classNames(
                'w-full px-3 py-2 rounded-lg text-sm',
                'bg-[#F8F8F8] dark:bg-[#1A1A1A]',
                'border border-[#E5E5E5] dark:border-[#333333]',
                'text-upage-elements-textPrimary placeholder-upage-elements-textTertiary',
                'focus:outline-none focus:ring-1 focus:ring-upage-elements-borderColorActive',
                'disabled:opacity-50',
              )}
            />
          </div>

          <button
            onClick={handleConnect}
            disabled={isConnecting || !serverUrl || !apiKey}
            className={classNames(
              'px-4 py-2 rounded-lg text-sm flex items-center gap-2',
              'bg-upage-elements-button-secondary-background',
              'hover:bg-upage-elements-button-secondary-backgroundHover',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {isConnecting ? (
              <>
                <div className="i-ph:spinner-gap animate-spin" />
                连接中...
              </>
            ) : (
              <>
                <div className="i-ph:plug-charging size-4" />
                连接
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm text-upage-elements-textSecondary flex items-center gap-1">
                <div className="i-ph:check-circle size-4 text-green-500" />
                已连接到 1Panel 服务器
              </span>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="outline"
                onClick={() => window.open(`${connection.serverUrl}/websites`, '_blank', 'noopener,noreferrer')}
                className="flex items-center gap-2 hover:bg-upage-elements-item-backgroundActive/10 hover:text-upage-elements-textPrimary dark:hover:text-upage-elements-textPrimary transition-colors"
              >
                <div className="i-mingcute:dashboard-line size-4" />
                仪表盘
              </Button>
              <Button
                onClick={() => fetch1PanelStats()}
                disabled={fetching}
                variant="outline"
                className="flex items-center gap-2 hover:bg-upage-elements-item-backgroundActive/10 hover:text-upage-elements-textPrimary dark:hover:text-upage-elements-textPrimary transition-colors"
              >
                {fetching ? (
                  <>
                    <div className="i-ph:spinner-gap size-4 animate-spin text-upage-elements-textPrimary dark:text-upage-elements-textPrimary" />
                    <span className="text-upage-elements-textPrimary dark:text-upage-elements-textPrimary">
                      刷新...
                    </span>
                  </>
                ) : (
                  <>
                    <div className="heroicons:arrow-path size-4 text-upage-elements-textPrimary dark:text-upage-elements-textPrimary" />
                    <span className="text-upage-elements-textPrimary dark:text-upage-elements-textPrimary">
                      刷新统计
                    </span>
                  </>
                )}
              </Button>
              <Button onClick={handleDisconnect} variant="destructive" size="sm" className="flex items-center gap-2">
                <div className="i-ph:sign-out size-4" />
                断开连接
              </Button>
            </div>
          </div>

          {renderStats()}
        </div>
      )}
    </ConnectionBorder>
  );
}
