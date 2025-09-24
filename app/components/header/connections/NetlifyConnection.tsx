import { useStore } from '@nanostores/react';
import { useFetcher, useRouteLoaderData } from '@remix-run/react';
import classNames from 'classnames';
import { formatDistanceToNow } from 'date-fns';
import { zhCN } from 'date-fns/locale/zh-CN';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '~/components/ui/Badge';
import { Button } from '~/components/ui/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/Collapsible';
import { fetchNetlifyStats, isFetchingStats, netlifyConnection, updateNetlifyConnection } from '~/lib/stores/netlify';
import type { ConnectionSettings } from '~/root';
import type { ApiResponse } from '~/types/global';
import type { NetlifyBuild, NetlifyDeploy, NetlifySite } from '~/types/netlify';
import { logger } from '~/utils/logger';
import ConnectionBorder from './components/ConnectionBorder';

// Add new interface for site actions
interface SiteAction {
  name: string;
  icon: string;
  action: (siteId: string) => Promise<void>;
  requiresConfirmation?: boolean;
  variant?: 'default' | 'destructive' | 'outline';
}

export default function NetlifyConnection() {
  const rootData = useRouteLoaderData<{ connectionSettings?: ConnectionSettings }>('root');
  const connectFetcher = useFetcher<ApiResponse>();
  const settingsFetcher = useFetcher<ApiResponse>();

  const connection = useStore(netlifyConnection);
  const [tokenInput, setTokenInput] = useState('');
  const fetchingStats = useStore(isFetchingStats);
  const [sites, setSites] = useState<NetlifySite[]>([]);
  const [deploys, setDeploys] = useState<NetlifyDeploy[]>([]);
  const [builds, setBuilds] = useState<NetlifyBuild[]>([]);
  const [deploymentCount, setDeploymentCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState('');
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [activeSiteIndex, setActiveSiteIndex] = useState(0);
  const [isActionLoading, setIsActionLoading] = useState(false);

  const isConnecting = useMemo(() => {
    return connectFetcher.state !== 'idle';
  }, [connectFetcher.state]);

  useEffect(() => {
    updateNetlifyConnection({
      isConnect: rootData?.connectionSettings?.netlifyConnection,
    });
  }, [rootData]);

  // Add site actions
  const siteActions: SiteAction[] = [
    {
      name: '清除缓存',
      icon: 'heroicons:arrow-path',
      action: async (siteId: string) => {
        try {
          const response = await fetch(`/api/netlify/sites/${siteId}/cache`, {
            method: 'POST',
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || '清除缓存失败');
          }

          toast.success('站点缓存清除成功');
        } catch (err: unknown) {
          const error = err instanceof Error ? err.message : '未知错误';
          toast.error(`清除站点缓存失败: ${error}`);
        }
      },
    },
    {
      name: '删除站点',
      icon: 'heroicons:trash',
      action: async (siteId: string) => {
        try {
          const response = await fetch(`/api/netlify/sites/${siteId}`, {
            method: 'DELETE',
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || '删除站点失败');
          }

          toast.success('站点删除成功');
          fetchNetlifyStats().catch((err) => {
            logger.error('获取 Netlify 统计信息失败:', err);
          });
        } catch (err: unknown) {
          const error = err instanceof Error ? err.message : '未知错误';
          toast.error(`删除站点失败: ${error}`);
        }
      },
      requiresConfirmation: true,
      variant: 'destructive',
    },
  ];

  const handleDeploy = async (siteId: string, deployId: string, action: 'lock' | 'unlock' | 'publish') => {
    try {
      setIsActionLoading(true);

      const response = await fetch(`/api/netlify/deploys/${deployId}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ siteId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to ${action} deploy`);
      }

      toast.success(`Deploy ${action}ed successfully`);
      fetchNetlifyStats().catch((err) => {
        logger.error('获取 Netlify 统计信息失败:', err);
      });
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to ${action} deploy: ${error}`);
    } finally {
      setIsActionLoading(false);
    }
  };

  useEffect(() => {
    if (connection.isConnect && (!connection.stats || !connection.stats.sites)) {
      fetchNetlifyStats().catch((err) => {
        logger.error('获取 Netlify 统计信息失败:', err);
      });
    }

    // Update local state from connection
    if (connection.stats) {
      setSites(connection.stats.sites || []);
      setDeploys(connection.stats.deploys || []);
      setBuilds(connection.stats.builds || []);
      setDeploymentCount(connection.stats.deploys?.length || 0);
      setLastUpdated(connection.stats.lastDeployTime || '');
    }
  }, [connection]);

  // 监听 connectFetcher 状态变化（连接）
  useEffect(() => {
    if (connectFetcher.state === 'idle' && connectFetcher.data) {
      if (connectFetcher.data.success) {
        updateNetlifyConnection({
          isConnect: connectFetcher.data.data.isConnect,
        });

        fetchNetlifyStats().catch((err) => {
          logger.error('获取 Netlify 统计信息失败:', err);
        });

        toast.success('连接 Netlify 成功');
        setTokenInput('');
      } else if (connectFetcher.data.message) {
        toast.error(connectFetcher.data.message || '连接失败');
      }
    }
  }, [connectFetcher.state, connectFetcher.data]);

  // 监听 settingsFetcher 状态变化（断开连接）
  useEffect(() => {
    if (settingsFetcher.state === 'idle' && settingsFetcher.data) {
      if (settingsFetcher.data.success) {
        localStorage.removeItem('netlify_connection');
        document.cookie = 'netlifyToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        updateNetlifyConnection({ isConnect: false });
        toast.success('断开 Netlify 连接');
      }
    }
  }, [settingsFetcher.state, settingsFetcher.data]);

  const handleConnect = async () => {
    if (!tokenInput) {
      toast.error('请输入 Netlify API 令牌');
      return;
    }

    try {
      connectFetcher.submit(
        { token: tokenInput },
        {
          method: 'POST',
          action: '/api/netlify/auth',
          encType: 'application/json',
        },
      );
    } catch (error) {
      logger.error('连接 Netlify 失败:', error);
      toast.error(`连接 Netlify 失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleDisconnect = async () => {
    try {
      settingsFetcher.submit(
        {
          category: 'connectivity',
          key: 'netlify_token',
        },
        {
          method: 'DELETE',
          action: '/api/user/settings',
          encType: 'application/json',
        },
      );
    } catch (error) {
      toast.error('断开 Netlify 连接失败');
      logger.error('断开 Netlify 连接失败:', error);
    }
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
                  Netlify 统计信息
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
                  <span>{connection.stats.totalSites} 站点</span>
                </Badge>
                <Badge
                  variant="outline"
                  className="flex items-center gap-1 text-upage-elements-textPrimary dark:text-upage-elements-textPrimary"
                >
                  <div className="heroicons:rocket-launch size-4 text-upage-elements-item-contentAccent" />
                  <span>{deploymentCount} 部署</span>
                </Badge>
                {lastUpdated && (
                  <Badge
                    variant="outline"
                    className="flex items-center gap-1 text-upage-elements-textPrimary dark:text-upage-elements-textPrimary"
                  >
                    <div className="heroicons:clock size-4 text-upage-elements-item-contentAccent" />
                    <span>更新于 {formatDistanceToNow(new Date(lastUpdated), { locale: zhCN })} 前</span>
                  </Badge>
                )}
              </div>
              {sites.length > 0 && (
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
                        onClick={() =>
                          fetchNetlifyStats().catch((err) => {
                            logger.error('获取 Netlify 统计信息失败:', err);
                          })
                        }
                        disabled={fetchingStats}
                        className="flex items-center gap-2 text-upage-elements-textPrimary dark:text-upage-elements-textPrimary hover:bg-upage-elements-item-backgroundActive/10"
                      >
                        <div
                          className={classNames(
                            'heroicons:arrow-path size-4 text-upage-elements-item-contentAccent dark:text-upage-elements-item-contentAccent',
                            { 'animate-spin': fetchingStats },
                          )}
                        />
                        {fetchingStats ? '刷新中...' : '刷新'}
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {sites.map((site, index) => (
                        <div
                          key={site.id}
                          className={classNames(
                            'bg-upage-elements-background dark:bg-upage-elements-background-depth-1 border rounded-lg p-4 transition-all',
                            activeSiteIndex === index
                              ? 'border-upage-elements-item-contentAccent bg-upage-elements-item-backgroundActive/10'
                              : 'border-upage-elements-borderColor hover:border-upage-elements-borderColorActive/70',
                          )}
                          onClick={() => {
                            setActiveSiteIndex(index);
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="heroicons:cloud size-5 text-upage-elements-item-contentAccent dark:text-upage-elements-item-contentAccent" />
                              <span className="font-medium text-upage-elements-textPrimary dark:text-upage-elements-textPrimary">
                                {site.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={site.published_deploy?.state === 'ready' ? 'default' : 'destructive'}
                                className="flex items-center gap-1 text-upage-elements-textPrimary dark:text-upage-elements-textPrimary"
                              >
                                {site.published_deploy?.state === 'ready' ? (
                                  <div className="heroicons:check-circle size-4 text-green-500" />
                                ) : (
                                  <div className="heroicons:x-circle size-4 text-red-500" />
                                )}
                                <span className="text-upage-elements-textPrimary dark:text-upage-elements-textPrimary">
                                  {site.published_deploy?.state || 'Unknown'}
                                </span>
                              </Badge>
                            </div>
                          </div>

                          <div className="mt-3 flex items-center gap-2">
                            <a
                              href={site.ssl_url || site.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm flex items-center gap-1 transition-colors text-upage-elements-link-text hover:text-upage-elements-link-textHover dark:text-white dark:hover:text-upage-elements-link-textHover"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="heroicons:cloud size-3 text-upage-elements-item-contentAccent dark:text-upage-elements-item-contentAccent" />
                              <span className="underline decoration-1 underline-offset-2">
                                {site.ssl_url || site.url}
                              </span>
                            </a>
                          </div>

                          {activeSiteIndex === index && (
                            <>
                              <div className="mt-4 pt-3 border-t border-upage-elements-borderColor">
                                <div className="flex items-center gap-2">
                                  {siteActions.map((action) => (
                                    <Button
                                      key={action.name}
                                      variant={action.variant || 'outline'}
                                      size="sm"
                                      onClick={async (e) => {
                                        e.stopPropagation();

                                        if (action.requiresConfirmation) {
                                          if (!confirm(`您确定要 ${action.name.toLowerCase()}?`)) {
                                            return;
                                          }
                                        }

                                        setIsActionLoading(true);
                                        await action.action(site.id);
                                        setIsActionLoading(false);
                                      }}
                                      disabled={isActionLoading}
                                      className="flex items-center gap-1 text-upage-elements-textPrimary dark:text-upage-elements-textPrimary"
                                    >
                                      <div
                                        className={`${action.icon} size-4 text-upage-elements-item-contentAccent dark:text-upage-elements-item-contentAccent`}
                                      />
                                      {action.name}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                              {site.published_deploy && (
                                <div className="mt-3 text-sm">
                                  <div className="flex items-center gap-1">
                                    <div className="heroicons:clock size-4 text-upage-elements-item-contentAccent dark:text-upage-elements-item-contentAccent" />
                                    <span className="text-upage-elements-textSecondary dark:text-upage-elements-textSecondary">
                                      发布于{' '}
                                      {formatDistanceToNow(new Date(site.published_deploy.published_at), {
                                        locale: zhCN,
                                      })}{' '}
                                      前
                                    </span>
                                  </div>
                                  {site.published_deploy.branch && (
                                    <div className="flex items-center gap-1 mt-1">
                                      <div className="heroicons:code-bracket size-4 text-upage-elements-item-contentAccent dark:text-upage-elements-item-contentAccent" />
                                      <span className="text-upage-elements-textSecondary dark:text-upage-elements-textSecondary">
                                        分支: {site.published_deploy.branch}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  {activeSiteIndex !== -1 && deploys.length > 0 && (
                    <div className="bg-upage-elements-background dark:bg-upage-elements-background-depth-1 border border-upage-elements-borderColor dark:border-upage-elements-borderColor rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium flex items-center gap-2 text-upage-elements-textPrimary dark:text-upage-elements-textPrimary">
                          <div className="heroicons:building-library size-4 text-upage-elements-item-contentAccent dark:text-upage-elements-item-contentAccent" />
                          最近部署
                        </h4>
                      </div>
                      <div className="space-y-2">
                        {deploys.map((deploy) => (
                          <div
                            key={deploy.id}
                            className="bg-upage-elements-background dark:bg-upage-elements-background-depth-1 border border-upage-elements-borderColor dark:border-upage-elements-borderColor rounded-lg p-3"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={
                                    deploy.state === 'ready'
                                      ? 'default'
                                      : deploy.state === 'error'
                                        ? 'destructive'
                                        : 'outline'
                                  }
                                  className="flex items-center gap-1"
                                >
                                  {deploy.state === 'ready' ? (
                                    <div className="heroicons:check-circle size-4 text-green-500" />
                                  ) : deploy.state === 'error' ? (
                                    <div className="heroicons:x-circle size-4 text-red-500" />
                                  ) : (
                                    <div className="heroicons:building-library size-4 text-upage-elements-item-contentAccent" />
                                  )}
                                  <span className="text-upage-elements-textPrimary dark:text-upage-elements-textPrimary">
                                    {deploy.state}
                                  </span>
                                </Badge>
                              </div>
                              <span className="text-xs text-upage-elements-textSecondary dark:text-upage-elements-textSecondary">
                                {formatDistanceToNow(new Date(deploy.created_at), { locale: zhCN })} 前
                              </span>
                            </div>
                            {deploy.branch && (
                              <div className="mt-2 text-xs text-upage-elements-textSecondary dark:text-upage-elements-textSecondary flex items-center gap-1">
                                <div className="heroicons:code-bracket size-3 text-upage-elements-item-contentAccent dark:text-upage-elements-item-contentAccent" />
                                <span className="text-upage-elements-textSecondary dark:text-upage-elements-textSecondary">
                                  分支: {deploy.branch}
                                </span>
                              </div>
                            )}
                            {deploy.deploy_url && (
                              <div className="mt-2 text-xs">
                                <a
                                  href={deploy.deploy_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1 transition-colors text-upage-elements-link-text hover:text-upage-elements-link-textHover dark:text-white dark:hover:text-upage-elements-link-textHover"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="heroicons:cloud size-3 text-upage-elements-item-contentAccent dark:text-upage-elements-item-contentAccent" />
                                  <span className="underline decoration-1 underline-offset-2">{deploy.deploy_url}</span>
                                </a>
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeploy(sites[activeSiteIndex].id, deploy.id, 'publish')}
                                disabled={isActionLoading}
                                className="flex items-center gap-1 text-upage-elements-textPrimary dark:text-upage-elements-textPrimary"
                              >
                                <div className="heroicons:building-library size-4 text-upage-elements-item-contentAccent dark:text-upage-elements-item-contentAccent" />
                                发布
                              </Button>
                              {deploy.state === 'ready' ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeploy(sites[activeSiteIndex].id, deploy.id, 'lock')}
                                  disabled={isActionLoading}
                                  className="flex items-center gap-1 text-upage-elements-textPrimary dark:text-upage-elements-textPrimary"
                                >
                                  <div className="heroicons:lock-closed size-4 text-upage-elements-item-contentAccent dark:text-upage-elements-item-contentAccent" />
                                  锁定
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeploy(sites[activeSiteIndex].id, deploy.id, 'unlock')}
                                  disabled={isActionLoading}
                                  className="flex items-center gap-1 text-upage-elements-textPrimary dark:text-upage-elements-textPrimary"
                                >
                                  <div className="heroicons:lock-open size-4 text-upage-elements-item-contentAccent dark:text-upage-elements-item-contentAccent" />
                                  解锁
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {activeSiteIndex !== -1 && builds.length > 0 && (
                    <div className="bg-upage-elements-background dark:bg-upage-elements-background-depth-1 border border-upage-elements-borderColor dark:border-upage-elements-borderColor rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-medium flex items-center gap-2 text-upage-elements-textPrimary dark:text-upage-elements-textPrimary">
                          <div className="heroicons:code-bracket size-4 text-upage-elements-item-contentAccent dark:text-upage-elements-item-contentAccent" />
                          最近构建
                        </h4>
                      </div>
                      <div className="space-y-2">
                        {builds.map((build) => (
                          <div
                            key={build.id}
                            className="bg-upage-elements-background dark:bg-upage-elements-background-depth-1 border border-upage-elements-borderColor dark:border-upage-elements-borderColor rounded-lg p-3"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant={
                                    build.done && !build.error ? 'default' : build.error ? 'destructive' : 'outline'
                                  }
                                  className="flex items-center gap-1"
                                >
                                  {build.done && !build.error ? (
                                    <div className="heroicons:check-circle size-4" />
                                  ) : build.error ? (
                                    <div className="heroicons:x-circle size-4" />
                                  ) : (
                                    <div className="heroicons:code-bracket size-4" />
                                  )}
                                  <span className="text-upage-elements-textPrimary dark:text-upage-elements-textPrimary">
                                    {build.done ? (build.error ? '失败' : '完成') : '进行中'}
                                  </span>
                                </Badge>
                              </div>
                              <span className="text-xs text-upage-elements-textSecondary dark:text-upage-elements-textSecondary">
                                {formatDistanceToNow(new Date(build.created_at), { locale: zhCN })} 前
                              </span>
                            </div>
                            {build.error && (
                              <div className="mt-2 text-xs text-upage-elements-textDestructive dark:text-upage-elements-textDestructive flex items-center gap-1">
                                <div className="heroicons:x-circle size-3 text-upage-elements-textDestructive dark:text-upage-elements-textDestructive" />
                                错误: {build.error}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    );
  };

  return (
    <ConnectionBorder>
      <div className="p-6">
        {!connection.isConnect ? (
          <div>
            <label className="block text-sm text-upage-elements-textSecondary dark:text-upage-elements-textSecondary mb-2">
              API 令牌
            </label>
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="输入您的 Netlify API 令牌"
              className={classNames(
                'w-full px-3 py-2 rounded-lg text-sm',
                'bg-upage-elements-background-depth-1 dark:bg-upage-elements-background-depth-1',
                'border border-upage-elements-borderColor dark:border-upage-elements-borderColor',
                'text-upage-elements-textPrimary dark:text-upage-elements-textPrimary placeholder-upage-elements-textTertiary dark:placeholder-upage-elements-textTertiary',
                'focus:outline-none focus:ring-1 focus:ring-upage-elements-item-contentAccent dark:focus:ring-upage-elements-item-contentAccent',
              )}
            />
            <div className="mt-2 text-sm text-upage-elements-textSecondary dark:text-upage-elements-textSecondary">
              <a
                href="https://app.netlify.com/user/applications#personal-access-tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="text-upage-elements-link-text dark:text-upage-elements-link-text hover:text-upage-elements-link-textHover dark:hover:text-upage-elements-link-textHover flex items-center gap-1"
              >
                <div className="i-ph:key size-4" />
                获取您的令牌
                <div className="i-ph:arrow-square-out size-3" />
              </a>
            </div>
            <div className="flex items-center justify-between mt-4">
              <Button
                onClick={handleConnect}
                disabled={isConnecting || !tokenInput}
                variant="default"
                className={classNames(
                  'px-4 py-2 rounded-lg text-sm flex items-center gap-2',
                  'bg-upage-elements-button-secondary-background',
                  'hover:bg-upage-elements-button-secondary-backgroundHover',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                {isConnecting ? (
                  <>
                    <div className="i-ph:spinner-gap animate-spin size-4" />
                    连接中...
                  </>
                ) : (
                  <>
                    <div className="heroicons:cloud size-4" />
                    连接
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col w-full gap-4 mt-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="heroicons:check-circle size-4 text-green-500" />
                <span className="text-sm text-upage-elements-textPrimary dark:text-upage-elements-textPrimary">
                  已连接到 Netlify
                </span>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <Button
                  variant="outline"
                  onClick={() => window.open('https://app.netlify.com', '_blank', 'noopener,noreferrer')}
                  className="flex items-center gap-2 hover:bg-upage-elements-item-backgroundActive/10 hover:text-upage-elements-textPrimary dark:hover:text-upage-elements-textPrimary transition-colors"
                >
                  <div className="i-mingcute:dashboard-line size-4" />
                  仪表盘
                </Button>
                <Button
                  onClick={() =>
                    fetchNetlifyStats().catch((err) => {
                      logger.error('获取 Netlify 统计信息失败:', err);
                    })
                  }
                  disabled={fetchingStats}
                  variant="outline"
                  className="flex items-center gap-2 hover:bg-upage-elements-item-backgroundActive/10 hover:text-upage-elements-textPrimary dark:hover:text-upage-elements-textPrimary transition-colors"
                >
                  {fetchingStats ? (
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
      </div>
    </ConnectionBorder>
  );
}
