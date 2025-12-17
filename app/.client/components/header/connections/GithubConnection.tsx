import { useStore } from '@nanostores/react';
import { useRevalidator } from 'react-router';
import classNames from 'classnames';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/.client/components/ui/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/.client/components/ui/Collapsible';
import { clearGitHubConnection, githubConnection, updateGitHubConnection } from '~/.client/stores/github';
import { logStore } from '~/.client/stores/logs';
import { logger } from '~/.client/utils/logger';
import ConnectionBorder from './components/ConnectionBorder';

export default function GitHubConnection() {
  const revalidator = useRevalidator();

  const connection = useStore(githubConnection);
  const [connectInfo, setConnectInfo] = useState<{ token: string; tokenType: 'classic' | 'fine-grained' }>({
    token: '',
    tokenType: 'classic',
  });
  const [isFetchingStats, setIsFetchingStats] = useState(false);
  const [isStatsExpanded, setIsStatsExpanded] = useState(false);

  useEffect(() => {
    if (connection.isConnect) {
      if (!connection.user || !connection.stats) {
        fetchGitHubStats();
      }
    }
  }, [connection.isConnect]);

  const fetchGithubAuth = async (token: string, tokenType: 'classic' | 'fine-grained') => {
    try {
      const response = await fetch('/api/github/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
          tokenType,
        }),
      });

      if (!response.ok) {
        logger.error('获取 GitHub 用户时出错。状态:', response.status);
        const errorData = await response.json();
        throw new Error(errorData.message || `错误: ${response.status}`);
      }
      fetchGitHubStats();
    } catch (error) {
      logStore.logError(`GitHub 认证失败: ${error instanceof Error ? error.message : '未知错误'}`, {
        type: 'system',
        message: 'GitHub 认证失败',
      });

      toast.error(`认证失败: ${error instanceof Error ? error.message : '未知错误'}`);
      throw error;
    }
  };

  const fetchGitHubStats = async () => {
    setIsFetchingStats(true);

    try {
      const response = await fetch('/api/github/stats', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 401) {
          toast.error('GitHub 令牌已过期，请重新连接您的账户');
          handleDisconnect();
          return;
        }

        throw new Error(errorData.message || `获取统计信息失败: ${response.status}`);
      }

      const data = await response.json();
      const { user: userData, stats } = data.data;

      updateGitHubConnection({
        user: userData,
        stats,
      });
      toast.success('GitHub 统计已刷新');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logger.error(`获取 GitHub 统计失败: ${errorMessage}`);
      toast.error(`获取 GitHub 统计失败: ${errorMessage}`);
    } finally {
      setIsFetchingStats(false);
    }
  };

  if (isFetchingStats) {
    return <LoadingSpinner />;
  }

  const handleConnect = async (token: string, tokenType: 'classic' | 'fine-grained') => {
    try {
      await fetchGithubAuth(token, tokenType);
      revalidator.revalidate();
      toast.success('已成功连接到 GitHub');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logger.error(`连接 GitHub 失败: ${errorMessage}`);
      setConnectInfo({ token, tokenType });
      toast.error(`连接 GitHub 失败: ${errorMessage}`);
    }
  };

  const handleDisconnect = async () => {
    try {
      await fetch('/api/github/disconnect', {
        method: 'DELETE',
      });

      clearGitHubConnection();
      setConnectInfo({ token: '', tokenType: 'classic' });
      revalidator.revalidate();
      toast.success('已断开与 GitHub 的连接');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logger.error(`断开连接失败: ${errorMessage}`);
      toast.error('无法断开连接');
    }
  };

  return (
    <ConnectionBorder>
      {!connection.isConnect && (
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm text-upage-elements-textSecondary dark:text-upage-elements-textSecondary mb-2">
              令牌类型
            </label>
            <select
              value={connectInfo.tokenType}
              onChange={(e) => {
                const newTokenType = e.target.value as 'classic' | 'fine-grained';
                setConnectInfo((prev) => ({ ...prev, tokenType: newTokenType }));
              }}
              className={classNames(
                'w-full px-3 py-2 rounded-lg text-sm',
                'bg-upage-elements-background-depth-1 dark:bg-upage-elements-background-depth-1',
                'border border-upage-elements-borderColor dark:border-upage-elements-borderColor',
                'text-upage-elements-textPrimary dark:text-upage-elements-textPrimary',
                'focus:outline-none focus:ring-1 focus:ring-upage-elements-item-contentAccent dark:focus:ring-upage-elements-item-contentAccent',
                'disabled:opacity-50',
              )}
            >
              <option value="classic">Personal Access Token (Classic)</option>
              <option value="fine-grained">Fine-grained Token</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-upage-elements-textSecondary dark:text-upage-elements-textSecondary mb-2">
              {connectInfo.tokenType === 'classic' ? 'Personal Access Token' : 'Fine-grained Token'}
            </label>
            <input
              type="password"
              value={connectInfo.token}
              onChange={(e) => setConnectInfo((prev) => ({ ...prev, token: e.target.value }))}
              disabled={revalidator.state === 'loading'}
              placeholder={`输入您的 GitHub ${
                connectInfo.tokenType === 'classic' ? 'personal access token' : 'fine-grained token'
              }`}
              className={classNames(
                'w-full px-3 py-2 rounded-lg text-sm',
                'bg-upage-elements-background-depth-1 dark:bg-upage-elements-background-depth-1',
                'border border-upage-elements-borderColor dark:border-upage-elements-borderColor',
                'text-upage-elements-textPrimary dark:text-upage-elements-textPrimary placeholder-upage-elements-textTertiary dark:placeholder-upage-elements-textTertiary',
                'focus:outline-none focus:ring-1 focus:ring-upage-elements-item-contentAccent dark:focus:ring-upage-elements-item-contentAccent',
                'disabled:opacity-50',
              )}
            />
            <div className="mt-2 text-sm text-upage-elements-textSecondary">
              <a
                href={`https://github.com/settings/tokens${connectInfo.tokenType === 'fine-grained' ? '/beta' : '/new'}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-upage-elements-link-text dark:text-upage-elements-link-text hover:text-upage-elements-link-textHover dark:hover:text-upage-elements-link-textHover flex items-center gap-1"
              >
                <div className="i-ph:key size-4" />
                获取您的令牌
                <div className="i-ph:arrow-square-out size-3" />
              </a>
              <span className="mx-2">•</span>
              <span>
                需要的权限:{' '}
                {connectInfo.tokenType === 'classic'
                  ? 'repo, read:org, read:user'
                  : 'Repository access, Organization access'}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        {!connection.isConnect && (
          <Button
            onClick={() => handleConnect(connectInfo.token, connectInfo.tokenType)}
            disabled={revalidator.state === 'loading' || !connectInfo.token}
            variant="default"
            className={classNames(
              'px-4 py-2 rounded-lg text-sm flex items-center gap-2',
              'bg-upage-elements-button-secondary-background',
              'hover:bg-upage-elements-button-secondary-backgroundHover',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {revalidator.state === 'loading' ? (
              <>
                <div className="i-ph:spinner-gap animate-spin size-4" />
                连接中...
              </>
            ) : (
              <>
                <div className="i-ph:github-logo size-4" />
                连接
              </>
            )}
          </Button>
        )}

        {connection.isConnect && (
          <>
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <div className="i-ph:check-circle size-4 text-upage-elements-icon-success dark:text-upage-elements-icon-success" />
                    <span className="text-sm text-upage-elements-textPrimary dark:text-upage-elements-textPrimary">
                      已连接到 GitHub 使用{' '}
                      <span className="text-upage-elements-item-contentAccent dark:text-upage-elements-item-contentAccent font-medium">
                        {connectInfo.tokenType === 'classic' ? 'PAT' : 'Fine-grained Token'}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => window.open('https://github.com/dashboard', '_blank', 'noopener,noreferrer')}
                  className="flex items-center gap-2 hover:bg-upage-elements-item-backgroundActive/10 hover:text-upage-elements-textPrimary dark:hover:text-upage-elements-textPrimary transition-colors"
                >
                  <div className="i-mingcute:dashboard-line size-4" />
                  仪表盘
                </Button>
                <Button
                  onClick={() => fetchGitHubStats()}
                  disabled={isFetchingStats}
                  variant="outline"
                  className="flex items-center gap-2 hover:bg-upage-elements-item-backgroundActive/10 hover:text-upage-elements-textPrimary dark:hover:text-upage-elements-textPrimary transition-colors"
                >
                  {isFetchingStats ? (
                    <>
                      <div className="i-ph:spinner-gap size-4 animate-spin" />
                      刷新...
                    </>
                  ) : (
                    <>
                      <div className="i-ph:arrows-clockwise size-4" />
                      刷新统计
                    </>
                  )}
                </Button>
                <Button onClick={handleDisconnect} variant="destructive" size="sm" className="flex items-center gap-2">
                  <div className="i-ph:sign-out size-4" />
                  断开连接
                </Button>
              </div>
            </div>
          </>
        )}
      </div>

      {connection.isConnect && connection?.user && (
        <div className="mt-6 border-t border-upage-elements-borderColor dark:border-upage-elements-borderColor pt-6">
          <div className="flex items-center gap-4 p-4 bg-upage-elements-background-depth-1 dark:bg-upage-elements-background-depth-1 rounded-lg mb-4">
            <img
              src={connection.user.avatar_url}
              alt={connection.user.login}
              className="size-12 rounded-full border-2 border-upage-elements-item-contentAccent dark:border-upage-elements-item-contentAccent"
            />
            <div>
              <h4 className="text-sm font-medium text-upage-elements-textPrimary dark:text-upage-elements-textPrimary">
                {connection.user.name || connection.user.login}
              </h4>
              <p className="text-sm text-upage-elements-textSecondary dark:text-upage-elements-textSecondary">
                {connection.user.login}
              </p>
            </div>
          </div>

          <Collapsible open={isStatsExpanded} onOpenChange={setIsStatsExpanded}>
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between p-4 rounded-lg bg-upage-elements-background dark:bg-upage-elements-background-depth-2 border border-upage-elements-borderColor dark:border-upage-elements-borderColor hover:border-upage-elements-borderColorActive/70 dark:hover:border-upage-elements-borderColorActive/70 transition-all duration-200 cursor-pointer">
                <div className="flex items-center gap-2">
                  <div className="i-ph:chart-bar size-4 text-upage-elements-item-contentAccent" />
                  <span className="text-sm font-medium text-upage-elements-textPrimary">GitHub 统计</span>
                </div>
                <div
                  className={classNames(
                    'i-ph:caret-down size-4 transform transition-transform duration-200 text-upage-elements-textSecondary',
                    isStatsExpanded ? 'rotate-180' : '',
                  )}
                />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent className="overflow-hidden">
              <div className="space-y-4 mt-4">
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-upage-elements-textPrimary mb-3">主要语言</h4>
                  <div className="flex flex-wrap gap-2">
                    {connection.stats?.languages &&
                      Object.entries(connection.stats.languages)
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 5)
                        .map(([language]) => (
                          <span
                            key={language}
                            className="px-3 py-1 text-xs rounded-full bg-upage-elements-sidebar-buttonBackgroundDefault text-upage-elements-sidebar-buttonText"
                          >
                            {language}
                          </span>
                        ))}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 mb-6">
                  {[
                    {
                      label: '注册时间',
                      value: new Date(connection.user.created_at).toLocaleDateString(),
                    },
                    {
                      label: '组织数量',
                      value: connection.stats?.organizations ? connection.stats.organizations.length : 0,
                    },
                    {
                      label: '语言数量',
                      value: connection.stats?.languages ? Object.keys(connection.stats.languages).length : 0,
                    },
                  ].map((stat, index) => (
                    <div
                      key={index}
                      className="flex flex-col p-3 rounded-lg bg-upage-elements-background-depth-2 dark:bg-upage-elements-background-depth-2 border border-upage-elements-borderColor dark:border-upage-elements-borderColor"
                    >
                      <span className="text-xs text-upage-elements-textSecondary">{stat.label}</span>
                      <span className="text-lg font-medium text-upage-elements-textPrimary">{stat.value}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4">
                  <div className="space-y-4">
                    <div>
                      <h5 className="text-sm font-medium text-upage-elements-textPrimary mb-2">仓库统计</h5>
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          {
                            label: '公开仓库',
                            value: connection.stats?.publicRepos,
                          },
                          {
                            label: '私有仓库',
                            value: connection.stats?.privateRepos,
                          },
                        ].map((stat, index) => (
                          <div
                            key={index}
                            className="flex flex-col p-3 rounded-lg bg-upage-elements-background-depth-2 dark:bg-upage-elements-background-depth-2 border border-upage-elements-borderColor dark:border-upage-elements-borderColor"
                          >
                            <span className="text-xs text-upage-elements-textSecondary">{stat.label}</span>
                            <span className="text-lg font-medium text-upage-elements-textPrimary">{stat.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h5 className="text-sm font-medium text-upage-elements-textPrimary mb-2">贡献统计</h5>
                      <div className="grid grid-cols-3 gap-4">
                        {[
                          {
                            label: '星标',
                            value: connection.stats?.totalStars || 0,
                            icon: 'i-ph:star',
                            iconColor: 'text-upage-elements-icon-warning',
                          },
                          {
                            label: 'Fork',
                            value: connection.stats?.totalForks || 0,
                            icon: 'i-ph:git-fork',
                            iconColor: 'text-upage-elements-icon-info',
                          },
                          {
                            label: '关注者',
                            value: connection.stats?.followers || 0,
                            icon: 'i-ph:users',
                            iconColor: 'text-upage-elements-icon-success',
                          },
                        ].map((stat, index) => (
                          <div
                            key={index}
                            className="flex flex-col p-3 rounded-lg bg-upage-elements-background-depth-2 dark:bg-upage-elements-background-depth-2 border border-upage-elements-borderColor dark:border-upage-elements-borderColor"
                          >
                            <span className="text-xs text-upage-elements-textSecondary">{stat.label}</span>
                            <span className="text-lg font-medium text-upage-elements-textPrimary flex items-center gap-1">
                              <div className={`${stat.icon} size-4 ${stat.iconColor}`} />
                              {stat.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h5 className="text-sm font-medium text-upage-elements-textPrimary mb-2">Gists</h5>
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          {
                            label: '公开 Gists',
                            value: connection.stats?.publicGists,
                          },
                          {
                            label: '私有 Gists',
                            value: connection.stats?.privateGists || 0,
                          },
                        ].map((stat, index) => (
                          <div
                            key={index}
                            className="flex flex-col p-3 rounded-lg bg-upage-elements-background-depth-2 dark:bg-upage-elements-background-depth-2 border border-upage-elements-borderColor dark:border-upage-elements-borderColor"
                          >
                            <span className="text-xs text-upage-elements-textSecondary">{stat.label}</span>
                            <span className="text-lg font-medium text-upage-elements-textPrimary">{stat.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {connection.stats?.lastUpdated && (
                      <div className="pt-2 border-t border-upage-elements-borderColor">
                        <span className="text-xs text-upage-elements-textSecondary">
                          更新时间: {new Date(connection.stats.lastUpdated).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-upage-elements-textPrimary">近期仓库</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {connection.stats?.repos.map((repo) => (
                      <a
                        key={repo.full_name}
                        href={repo.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group block p-4 rounded-lg bg-upage-elements-background-depth-1 dark:bg-upage-elements-background-depth-1 border border-upage-elements-borderColor dark:border-upage-elements-borderColor hover:border-upage-elements-borderColorActive dark:hover:border-upage-elements-borderColorActive transition-all duration-200"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <div className="i-mingcute:github-line size-4 text-upage-elements-icon-info dark:text-upage-elements-icon-info" />
                              <h5 className="text-sm font-medium text-upage-elements-textPrimary group-hover:text-upage-elements-item-contentAccent transition-colors">
                                {repo.name}
                              </h5>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-upage-elements-textSecondary">
                              <span className="flex items-center gap-1" title="Stars">
                                <div className="i-ph:star w-3.5 h-3.5 text-upage-elements-icon-warning" />
                                {repo.stargazers_count.toLocaleString()}
                              </span>
                              <span className="flex items-center gap-1" title="Forks">
                                <div className="i-ph:git-fork w-3.5 h-3.5 text-upage-elements-icon-info" />
                                {repo.forks_count.toLocaleString()}
                              </span>
                            </div>
                          </div>

                          {repo.description && (
                            <p className="text-xs text-upage-elements-textSecondary line-clamp-2">{repo.description}</p>
                          )}

                          <div className="flex items-center gap-3 text-xs text-upage-elements-textSecondary">
                            <span className="flex items-center gap-1" title="Default Branch">
                              <div className="i-ph:git-branch w-3.5 h-3.5" />
                              {repo.default_branch}
                            </span>
                            <span className="flex items-center gap-1" title="Last Updated">
                              <div className="i-ph:clock w-3.5 h-3.5" />
                              {new Date(repo.updated_at).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                            <span className="flex items-center gap-1 ml-auto group-hover:text-upage-elements-item-contentAccent transition-colors">
                              <div className="i-ph:arrow-square-out w-3.5 h-3.5" />
                              View
                            </span>
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
    </ConnectionBorder>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-4">
      <div className="flex items-center gap-2">
        <div className="i-ph:spinner-gap-bold animate-spin size-4" />
        <span className="text-upage-elements-textSecondary">加载数据中...</span>
      </div>
    </div>
  );
}
