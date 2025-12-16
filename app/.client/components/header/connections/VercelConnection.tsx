import { useStore } from '@nanostores/react';
import { useFetcher, useRouteLoaderData } from '@remix-run/react';
import classNames from 'classnames';
import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { logStore } from '~/.client/stores/logs';
import { fetchVercelStats, isFetchingStats, updateVercelConnection, vercelConnection } from '~/.client/stores/vercel';
import { logger } from '~/.client/utils/logger';
import type { ConnectionSettings } from '~/root';
import ConnectionBorder from './components/ConnectionBorder';

interface ApiResponse {
  success: boolean;
  message?: string;
  data?: any;
}

export default function VercelConnection() {
  const rootData = useRouteLoaderData<{ connectionSettings?: ConnectionSettings }>('root');
  const settingsFetcher = useFetcher<ApiResponse>();
  const connectFetcher = useFetcher<ApiResponse>();

  const connection = useStore(vercelConnection);
  const fetchingStats = useStore(isFetchingStats);
  const [isProjectsExpanded, setIsProjectsExpanded] = useState(false);
  const [tokenInput, setTokenInput] = useState('');

  useEffect(() => {
    updateVercelConnection({
      isConnect: rootData?.connectionSettings?.vercelConnection,
    });
  }, [rootData]);

  useEffect(() => {
    if (connection.isConnect) {
      fetchVercelStats().catch((err) => {
        logger.error('获取 Vercel 统计信息失败:', err);
      });
      if (!connection.user) {
        handleConnect();
      }
    }
  }, [connection.isConnect]);

  useEffect(() => {
    if (settingsFetcher.state === 'idle' && settingsFetcher.data) {
      if (settingsFetcher.data.success) {
        updateVercelConnection({ isConnect: false, user: null });
        toast.success('断开 Vercel 连接');
      }
    }
  }, [settingsFetcher.state, settingsFetcher.data]);

  useEffect(() => {
    if (connectFetcher.state === 'idle' && connectFetcher.data) {
      if (connectFetcher.data.success) {
        updateVercelConnection({
          isConnect: connectFetcher.data.data.isConnect,
          user: connectFetcher.data.data.user,
        });
        toast.success('连接 Vercel 成功');
        setTokenInput('');
      } else if (connectFetcher.data.message) {
        toast.error(connectFetcher.data.message || '连接失败');
        updateVercelConnection({ isConnect: false, user: null });
      }
    }
  }, [connectFetcher.state, connectFetcher.data]);

  const isConnecting = useMemo(() => {
    return connectFetcher.state !== 'idle';
  }, [connectFetcher.state]);

  const handleConnect = async () => {
    try {
      connectFetcher.submit(
        { token: tokenInput },
        {
          method: 'POST',
          action: '/api/vercel/auth',
          encType: 'application/json',
        },
      );
    } catch (error) {
      toast.error('连接 Vercel 失败');
      logger.error('连接 Vercel 失败:', error);
      logStore.logError('Failed to authenticate with Vercel', { error });
    }
  };

  const handleDisconnect = async () => {
    try {
      settingsFetcher.submit(
        {
          category: 'connectivity',
          key: 'vercel_token',
        },
        {
          method: 'DELETE',
          action: '/api/user/settings',
          encType: 'application/json',
        },
      );
    } catch (error) {
      toast.error('断开 Vercel 连接失败');
      logger.error('断开 Vercel 连接失败:', error);
    }
  };

  return (
    <ConnectionBorder>
      {!connection.isConnect ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-upage-elements-textSecondary mb-2">个人访问令牌</label>
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              disabled={isConnecting}
              placeholder="输入您的 Vercel 个人访问令牌"
              className={classNames(
                'w-full px-3 py-2 rounded-lg text-sm',
                'bg-[#F8F8F8] dark:bg-[#1A1A1A]',
                'border border-[#E5E5E5] dark:border-[#333333]',
                'text-upage-elements-textPrimary placeholder-upage-elements-textTertiary',
                'focus:outline-none focus:ring-1 focus:ring-upage-elements-borderColorActive',
                'disabled:opacity-50',
              )}
            />
            <div className="mt-2 text-sm text-upage-elements-textSecondary">
              <a
                href="https://vercel.com/account/tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="text-upage-elements-borderColorActive hover:underline inline-flex items-center gap-1"
              >
                获取您的令牌
                <div className="i-ph:arrow-square-out size-4" />
              </a>
            </div>
          </div>

          <button
            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
              e.preventDefault();
              if (!tokenInput) {
                toast.error('请输入 Vercel 访问令牌');
                return;
              }
              handleConnect();
            }}
            disabled={isConnecting || !tokenInput}
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
              <button
                onClick={handleDisconnect}
                className={classNames(
                  'px-4 py-2 rounded-lg text-sm flex items-center gap-2',
                  'bg-red-500 text-white',
                  'hover:bg-red-600',
                )}
              >
                <div className="i-ph:plug size-4" />
                断开连接
              </button>
              <span className="text-sm text-upage-elements-textSecondary flex items-center gap-1">
                <div className="i-ph:check-circle size-4 text-green-500" />
                已连接到 Vercel
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 bg-[#F8F8F8] dark:bg-[#1A1A1A] rounded-lg">
            <pre className="hidden">{JSON.stringify(connection.user, null, 2)}</pre>

            <img
              src={`https://vercel.com/api/www/avatar?u=${connection.user?.username || connection.user?.user?.username}`}
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
              alt="User Avatar"
              className="size-12 rounded-full border-2 border-upage-elements-borderColorActive"
            />
            <div>
              <h4 className="text-sm font-medium text-upage-elements-textPrimary">
                {connection.user?.username || connection.user?.user?.username || 'Vercel User'}
              </h4>
              <p className="text-sm text-upage-elements-textSecondary">
                {connection.user?.email || connection.user?.user?.email || 'No email available'}
              </p>
            </div>
          </div>

          {fetchingStats ? (
            <div className="flex items-center gap-2 text-sm text-upage-elements-textSecondary">
              <div className="i-ph:spinner-gap size-4 animate-spin" />
              正在获取 Vercel 项目...
            </div>
          ) : (
            <div>
              <button
                onClick={() => setIsProjectsExpanded(!isProjectsExpanded)}
                className="w-full bg-transparent text-left text-sm font-medium text-upage-elements-textPrimary mb-3 flex items-center gap-2"
              >
                <div className="i-ph:buildings size-4" />
                您的项目 ({connection.stats?.totalProjects || 0})
                <div
                  className={classNames(
                    'i-ph:caret-down size-4 ml-auto transition-transform',
                    isProjectsExpanded ? 'rotate-180' : '',
                  )}
                />
              </button>
              {isProjectsExpanded && connection.stats?.projects?.length ? (
                <div className="grid gap-3">
                  {connection.stats.projects.map((project) => (
                    <a
                      key={project.id}
                      href={`https://vercel.com/dashboard/${project.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-4 rounded-lg border border-upage-elements-borderColor hover:border-upage-elements-borderColorActive transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h5 className="text-sm font-medium text-upage-elements-textPrimary flex items-center gap-2">
                            <div className="i-ph:globe size-4 text-upage-elements-borderColorActive" />
                            {project.name}
                          </h5>
                          <div className="flex items-center gap-2 mt-2 text-xs text-upage-elements-textSecondary">
                            {project.targets?.production?.alias && project.targets.production.alias.length > 0 ? (
                              <>
                                <a
                                  href={`https://${project.targets.production.alias.find((a: string) => a.endsWith('.vercel.app') && !a.includes('-projects.vercel.app')) || project.targets.production.alias[0]}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:text-upage-elements-borderColorActive"
                                >
                                  {project.targets.production.alias.find(
                                    (a: string) => a.endsWith('.vercel.app') && !a.includes('-projects.vercel.app'),
                                  ) || project.targets.production.alias[0]}
                                </a>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <div className="i-ph:clock size-3" />
                                  {new Date(project.createdAt).toLocaleDateString()}
                                </span>
                              </>
                            ) : project.latestDeployments && project.latestDeployments.length > 0 ? (
                              <>
                                <a
                                  href={`https://${project.latestDeployments[0].url}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="hover:text-upage-elements-borderColorActive"
                                >
                                  {project.latestDeployments[0].url}
                                </a>
                                <span>•</span>
                                <span className="flex items-center gap-1">
                                  <div className="i-ph:clock size-3" />
                                  {new Date(project.latestDeployments[0].created).toLocaleDateString()}
                                </span>
                              </>
                            ) : null}
                          </div>
                        </div>
                        {project.framework && (
                          <div className="text-xs text-upage-elements-textSecondary px-2 py-1 rounded-md bg-[#F0F0F0] dark:bg-[#252525]">
                            <span className="flex items-center gap-1">
                              <div className="i-mingcute:code-line size-3" />
                              {project.framework}
                            </span>
                          </div>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              ) : isProjectsExpanded ? (
                <div className="text-sm text-upage-elements-textSecondary flex items-center gap-2">
                  <div className="i-ph:info size-4" />
                  未找到您的 Vercel 账户中的项目
                </div>
              ) : null}
            </div>
          )}
        </div>
      )}
    </ConnectionBorder>
  );
}
