import classNames from 'classnames';
import Cookies from 'js-cookie';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '~/.client/components/ui/Button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/.client/components/ui/Collapsible';
import { logStore } from '~/stores/logs';
import ConnectionBorder from './components/ConnectionBorder';

interface GitHubUserResponse {
  login: string;
  avatar_url: string;
  html_url: string;
  name: string;
  bio: string;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
  public_gists: number;
}

interface GitHubRepoInfo {
  name: string;
  full_name: string;
  html_url: string;
  description: string;
  stargazers_count: number;
  forks_count: number;
  default_branch: string;
  updated_at: string;
  languages_url: string;
}

interface GitHubOrganization {
  login: string;
  avatar_url: string;
  html_url: string;
}

interface GitHubEvent {
  id: string;
  type: string;
  repo: {
    name: string;
  };
  created_at: string;
}

interface GitHubLanguageStats {
  [language: string]: number;
}

interface GitHubStats {
  repos: GitHubRepoInfo[];
  recentActivity: GitHubEvent[];
  languages: GitHubLanguageStats;
  totalGists: number;
  publicRepos: number;
  privateRepos: number;
  stars: number;
  forks: number;
  followers: number;
  publicGists: number;
  privateGists: number;
  lastUpdated: string;

  // Keep these for backward compatibility
  totalStars?: number;
  totalForks?: number;
  organizations?: GitHubOrganization[];
}

interface GitHubConnection {
  user: GitHubUserResponse | null;
  token: string;
  tokenType: 'classic' | 'fine-grained';
  stats?: GitHubStats;
  rateLimit?: {
    limit: number;
    remaining: number;
    reset: number;
  };
}

export default function GitHubConnection() {
  const [connection, setConnection] = useState<GitHubConnection>({
    user: null,
    token: '',
    tokenType: 'classic',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isFetchingStats, setIsFetchingStats] = useState(false);
  const [isStatsExpanded, setIsStatsExpanded] = useState(false);
  const tokenTypeRef = React.useRef<'classic' | 'fine-grained'>('classic');

  const fetchGithubUser = async (token: string) => {
    try {
      console.log('正在获取 GitHub 用户，使用令牌:', token.substring(0, 5) + '...');

      // Use server-side API endpoint instead of direct GitHub API call
      const response = await fetch(`/api/system/git-info?action=getUser`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`, // Include token in headers for validation
        },
      });

      if (!response.ok) {
        console.error('获取 GitHub 用户时出错。状态:', response.status);
        throw new Error(`错误: ${response.status}`);
      }

      // Get rate limit information from headers
      const rateLimit = {
        limit: parseInt(response.headers.get('x-ratelimit-limit') || '0'),
        remaining: parseInt(response.headers.get('x-ratelimit-remaining') || '0'),
        reset: parseInt(response.headers.get('x-ratelimit-reset') || '0'),
      };

      const data = await response.json();
      console.log('GitHub 用户 API 响应:', data);

      const { user } = data as { user: GitHubUserResponse };

      // Validate that we received a user object
      if (!user || !user.login) {
        console.error('收到无效的用户数据:', user);
        throw new Error('收到无效的用户数据');
      }

      // Use the response data
      setConnection((prev) => ({
        ...prev,
        user,
        token,
        tokenType: tokenTypeRef.current,
        rateLimit,
      }));

      // Set cookies for client-side access
      Cookies.set('githubUsername', user.login);
      Cookies.set('githubToken', token);
      Cookies.set('git:github.com', JSON.stringify({ username: token, password: 'x-oauth-basic' }));

      // Store connection details in localStorage
      localStorage.setItem(
        'github_connection',
        JSON.stringify({
          user,
          token,
          tokenType: tokenTypeRef.current,
        }),
      );

      logStore.logInfo('已连接到 GitHub', {
        type: 'system',
        message: `已连接到 GitHub，用户： ${user.login}`,
      });

      // Fetch additional GitHub stats
      fetchGitHubStats(token);
    } catch (error) {
      console.error('Failed to fetch GitHub user:', error);
      logStore.logError(`GitHub 认证失败: ${error instanceof Error ? error.message : '未知错误'}`, {
        type: 'system',
        message: 'GitHub 认证失败',
      });

      toast.error(`认证失败: ${error instanceof Error ? error.message : '未知错误'}`);
      throw error; // Rethrow to allow handling in the calling function
    }
  };

  const fetchGitHubStats = async (token: string) => {
    setIsFetchingStats(true);

    try {
      // Get the current user first to ensure we have the latest value
      const userResponse = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `${connection.tokenType === 'classic' ? 'token' : 'Bearer'} ${token}`,
        },
      });

      if (!userResponse.ok) {
        if (userResponse.status === 401) {
          toast.error('您的 GitHub 令牌已过期。请重新连接您的账户。');
          handleDisconnect();

          return;
        }

        throw new Error(`Failed to fetch user data: ${userResponse.statusText}`);
      }

      const userData = (await userResponse.json()) as any;

      // Fetch repositories with pagination
      let allRepos: any[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const reposResponse = await fetch(`https://api.github.com/user/repos?per_page=100&page=${page}`, {
          headers: {
            Authorization: `${connection.tokenType === 'classic' ? 'token' : 'Bearer'} ${token}`,
          },
        });

        if (!reposResponse.ok) {
          throw new Error(`Failed to fetch repositories: ${reposResponse.statusText}`);
        }

        const repos = (await reposResponse.json()) as any[];
        allRepos = [...allRepos, ...repos];

        // Check if there are more pages
        const linkHeader = reposResponse.headers.get('Link');
        hasMore = linkHeader?.includes('rel="next"') ?? false;
        page++;
      }

      // Calculate stats
      const repoStats = await calculateRepoStats(allRepos);

      // Fetch recent activity
      const eventsResponse = await fetch(`https://api.github.com/users/${userData.login}/events?per_page=10`, {
        headers: {
          Authorization: `${connection.tokenType === 'classic' ? 'token' : 'Bearer'} ${token}`,
        },
      });

      if (!eventsResponse.ok) {
        throw new Error(`Failed to fetch events: ${eventsResponse.statusText}`);
      }

      const events = (await eventsResponse.json()) as any[];
      const recentActivity = events.slice(0, 5).map((event: any) => ({
        id: event.id,
        type: event.type,
        repo: event.repo.name,
        created_at: event.created_at,
      }));

      // Calculate total stars and forks
      const totalStars = allRepos.reduce((sum: number, repo: any) => sum + repo.stargazers_count, 0);
      const totalForks = allRepos.reduce((sum: number, repo: any) => sum + repo.forks_count, 0);
      const privateRepos = allRepos.filter((repo: any) => repo.private).length;

      // Update the stats in the store
      const stats: GitHubStats = {
        repos: repoStats.repos,
        recentActivity,
        languages: repoStats.languages || {},
        totalGists: repoStats.totalGists || 0,
        publicRepos: userData.public_repos || 0,
        privateRepos: privateRepos || 0,
        stars: totalStars || 0,
        forks: totalForks || 0,
        followers: userData.followers || 0,
        publicGists: userData.public_gists || 0,
        privateGists: userData.private_gists || 0,
        lastUpdated: new Date().toISOString(),

        // For backward compatibility
        totalStars: totalStars || 0,
        totalForks: totalForks || 0,
        organizations: [],
      };

      // Get the current user first to ensure we have the latest value
      const currentConnection = JSON.parse(localStorage.getItem('github_connection') || '{}');
      const currentUser = currentConnection.user || connection.user;

      // Update connection with stats
      const updatedConnection: GitHubConnection = {
        user: currentUser,
        token,
        tokenType: connection.tokenType,
        stats,
        rateLimit: connection.rateLimit,
      };

      // Update localStorage
      localStorage.setItem('github_connection', JSON.stringify(updatedConnection));

      // Update state
      setConnection(updatedConnection);

      toast.success('GitHub 统计已刷新');
    } catch (error) {
      console.error('Error fetching GitHub stats:', error);
      toast.error(`Failed to fetch GitHub stats: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsFetchingStats(false);
    }
  };

  const calculateRepoStats = async (
    repos: any[],
  ): Promise<{ repos: GitHubRepoInfo[]; languages: GitHubLanguageStats; totalGists: number }> => {
    // 构建基本仓库信息
    const repoStats = {
      repos: repos.map((repo: any) => ({
        name: repo.name,
        full_name: repo.full_name,
        html_url: repo.html_url,
        description: repo.description,
        stargazers_count: repo.stargazers_count,
        forks_count: repo.forks_count,
        default_branch: repo.default_branch,
        updated_at: repo.updated_at,
        languages_url: repo.languages_url,
      })),

      languages: {} as Record<string, number>,
      totalGists: 0,
    };

    // 首先使用仓库的主要语言属性构建基本的语言统计
    repos.forEach((repo: any) => {
      if (repo.language) {
        if (!repoStats.languages[repo.language]) {
          repoStats.languages[repo.language] = 0;
        }
        repoStats.languages[repo.language] += 1;
      }
    });

    const topRepos = [...repos].sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 10);

    try {
      const batchSize = 3;
      for (let i = 0; i < topRepos.length; i += batchSize) {
        const batch = topRepos.slice(i, i + batchSize);

        const batchPromises = batch.map((repo) =>
          fetch(repo.languages_url)
            .then((response) => {
              if (!response.ok) {
                if (response.status === 429) {
                  console.warn('GitHub API rate limit exceeded when fetching languages');
                  throw new Error('Rate limit exceeded');
                }
                throw new Error(`Error fetching languages: ${response.status}`);
              }
              return response.json();
            })
            .then((languages: any) => {
              const typedLanguages = languages as Record<string, number>;
              Object.keys(typedLanguages).forEach((language) => {
                if (!repoStats.languages[language]) {
                  repoStats.languages[language] = 0;
                }
                repoStats.languages[language] += 1;
              });
            })
            .catch((error) => {
              console.error(`Error processing languages for ${repo.name}:`, error);
            }),
        );

        await Promise.all(batchPromises);

        if (i + batchSize < topRepos.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
    } catch (error) {
      console.error('Error fetching repository languages:', error);
    }

    return repoStats;
  };

  useEffect(() => {
    const loadSavedConnection = async () => {
      setIsLoading(true);

      const savedConnection = localStorage.getItem('github_connection');

      if (savedConnection) {
        try {
          const parsed = JSON.parse(savedConnection);

          if (!parsed.tokenType) {
            parsed.tokenType = 'classic';
          }

          // Update the ref with the parsed token type
          tokenTypeRef.current = parsed.tokenType;

          // Set the connection
          setConnection(parsed);

          // If we have a token but no stats or incomplete stats, fetch them
          if (
            parsed.user &&
            parsed.token &&
            (!parsed.stats || !parsed.stats.repos || parsed.stats.repos.length === 0)
          ) {
            console.log('Fetching missing GitHub stats for saved connection');
            await fetchGitHubStats(parsed.token);
          }
        } catch (error) {
          console.error('Error parsing saved GitHub connection:', error);
          localStorage.removeItem('github_connection');
        }
      }

      setIsLoading(false);
    };

    loadSavedConnection();
  }, []);

  // Ensure cookies are updated when connection changes
  useEffect(() => {
    if (!connection) {
      return;
    }

    const token = connection.token;
    const data = connection.user;

    if (token) {
      Cookies.set('githubToken', token);
      Cookies.set('git:github.com', JSON.stringify({ username: token, password: 'x-oauth-basic' }));
    }

    if (data) {
      Cookies.set('githubUsername', data.login);
    }
  }, [connection]);

  // Add function to update rate limits
  const updateRateLimits = async (token: string) => {
    try {
      const response = await fetch('https://api.github.com/rate_limit', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (response.ok) {
        const rateLimit = {
          limit: parseInt(response.headers.get('x-ratelimit-limit') || '0'),
          remaining: parseInt(response.headers.get('x-ratelimit-remaining') || '0'),
          reset: parseInt(response.headers.get('x-ratelimit-reset') || '0'),
        };

        setConnection((prev) => ({
          ...prev,
          rateLimit,
        }));
      }
    } catch (error) {
      console.error('Failed to fetch rate limits:', error);
    }
  };

  // Add effect to update rate limits periodically
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (connection.token && connection.user) {
      updateRateLimits(connection.token);
      interval = setInterval(() => updateRateLimits(connection.token), 60000); // Update every minute
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [connection.token, connection.user]);

  if (isLoading || isConnecting || isFetchingStats) {
    return <LoadingSpinner />;
  }

  const handleConnect = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsConnecting(true);

    try {
      // Update the ref with the current state value before connecting
      tokenTypeRef.current = connection.tokenType;

      /*
       * Save token type to localStorage even before connecting
       * This ensures the token type is persisted even if connection fails
       */
      localStorage.setItem(
        'github_connection',
        JSON.stringify({
          user: null,
          token: connection.token,
          tokenType: connection.tokenType,
        }),
      );

      // Attempt to fetch the user info which validates the token
      await fetchGithubUser(connection.token);

      toast.success('已成功连接到 GitHub');
    } catch (error) {
      console.error('Failed to connect to GitHub:', error);

      // Reset connection state on failure
      setConnection({ user: null, token: connection.token, tokenType: connection.tokenType });

      toast.error(`Failed to connect to GitHub: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    localStorage.removeItem('github_connection');

    // Remove all GitHub-related cookies
    Cookies.remove('githubToken');
    Cookies.remove('githubUsername');
    Cookies.remove('git:github.com');

    // Reset the token type ref
    tokenTypeRef.current = 'classic';
    setConnection({ user: null, token: '', tokenType: 'classic' });
    toast.success('已断开与 GitHub 的连接');
  };

  return (
    <ConnectionBorder>
      {!isConnecting && !connection.user && (
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm text-upage-elements-textSecondary dark:text-upage-elements-textSecondary mb-2">
              令牌类型
            </label>
            <select
              value={connection.tokenType}
              onChange={(e) => {
                const newTokenType = e.target.value as 'classic' | 'fine-grained';
                tokenTypeRef.current = newTokenType;
                setConnection((prev) => ({ ...prev, tokenType: newTokenType }));
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
              {connection.tokenType === 'classic' ? 'Personal Access Token' : 'Fine-grained Token'}
            </label>
            <input
              type="password"
              value={connection.token}
              onChange={(e) => setConnection((prev) => ({ ...prev, token: e.target.value }))}
              disabled={isConnecting || !!connection.user}
              placeholder={`输入您的 GitHub ${
                connection.tokenType === 'classic' ? 'personal access token' : 'fine-grained token'
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
                href={`https://github.com/settings/tokens${connection.tokenType === 'fine-grained' ? '/beta' : '/new'}`}
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
                {connection.tokenType === 'classic'
                  ? 'repo, read:org, read:user'
                  : 'Repository access, Organization access'}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        {!connection.user ? (
          <Button
            onClick={handleConnect}
            disabled={isConnecting || !connection.token}
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
                <div className="i-ph:github-logo size-4" />
                连接
              </>
            )}
          </Button>
        ) : (
          <>
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <div className="i-ph:check-circle size-4 text-upage-elements-icon-success dark:text-upage-elements-icon-success" />
                    <span className="text-sm text-upage-elements-textPrimary dark:text-upage-elements-textPrimary">
                      已连接到 GitHub 使用{' '}
                      <span className="text-upage-elements-item-contentAccent dark:text-upage-elements-item-contentAccent font-medium">
                        {connection.tokenType === 'classic' ? 'PAT' : 'Fine-grained Token'}
                      </span>
                    </span>
                  </div>
                  {connection.rateLimit && (
                    <div className="flex items-center gap-2 text-xs text-upage-elements-textSecondary">
                      <div className="i-ph:chart-line-up w-3.5 h-3.5 text-upage-elements-icon-success" />
                      <span>
                        API 限制: {connection.rateLimit.remaining.toLocaleString()}/
                        {connection.rateLimit.limit.toLocaleString()} • 重置时间:
                        {Math.max(0, Math.floor((connection.rateLimit.reset * 1000 - Date.now()) / 60000))} min
                      </span>
                    </div>
                  )}
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
                  onClick={() => {
                    fetchGitHubStats(connection.token);
                    updateRateLimits(connection.token);
                  }}
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

      {connection.user && connection.stats && (
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
                {/* Languages Section */}
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-upage-elements-textPrimary mb-3">Top Languages</h4>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(connection.stats.languages)
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

                {/* Additional Stats */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                  {[
                    {
                      label: 'Member Since',
                      value: new Date(connection.user.created_at).toLocaleDateString(),
                    },
                    {
                      label: 'Public Gists',
                      value: connection.stats.publicGists,
                    },
                    {
                      label: 'Organizations',
                      value: connection.stats.organizations ? connection.stats.organizations.length : 0,
                    },
                    {
                      label: 'Languages',
                      value: Object.keys(connection.stats.languages).length,
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

                {/* Repository Stats */}
                <div className="mt-4">
                  <div className="space-y-4">
                    <div>
                      <h5 className="text-sm font-medium text-upage-elements-textPrimary mb-2">Repository Stats</h5>
                      <div className="grid grid-cols-2 gap-4">
                        {[
                          {
                            label: 'Public Repos',
                            value: connection.stats.publicRepos,
                          },
                          {
                            label: 'Private Repos',
                            value: connection.stats.privateRepos,
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
                      <h5 className="text-sm font-medium text-upage-elements-textPrimary mb-2">Contribution Stats</h5>
                      <div className="grid grid-cols-3 gap-4">
                        {[
                          {
                            label: 'Stars',
                            value: connection.stats.stars || 0,
                            icon: 'i-ph:star',
                            iconColor: 'text-upage-elements-icon-warning',
                          },
                          {
                            label: 'Forks',
                            value: connection.stats.forks || 0,
                            icon: 'i-ph:git-fork',
                            iconColor: 'text-upage-elements-icon-info',
                          },
                          {
                            label: 'Followers',
                            value: connection.stats.followers || 0,
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
                            label: 'Public',
                            value: connection.stats.publicGists,
                          },
                          {
                            label: 'Private',
                            value: connection.stats.privateGists || 0,
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

                    <div className="pt-2 border-t border-upage-elements-borderColor">
                      <span className="text-xs text-upage-elements-textSecondary">
                        Last updated: {new Date(connection.stats.lastUpdated).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Repositories Section */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-upage-elements-textPrimary">Recent Repositories</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {connection.stats.repos.map((repo) => (
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
        <span className="text-upage-elements-textSecondary">加载仓库中...</span>
      </div>
    </div>
  );
}
