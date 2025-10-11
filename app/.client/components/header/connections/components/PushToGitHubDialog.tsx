import { Octokit } from '@octokit/rest';
import * as Dialog from '@radix-ui/react-dialog';
import classNames from 'classnames';
import { motion } from 'framer-motion';
import React, { Suspense, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getLocalStorage } from '~/.client/persistence';
import { webBuilderStore } from '~/.client/stores/web-builder';
import { formatSize } from '~/.client/utils/format';
import { logStore } from '~/stores/logs';
import type { GitHubUserResponse } from '~/types/github';
import { logger } from '~/utils/logger';

const GitHubConnection = React.lazy(() => import('~/.client/components/header/connections/GithubConnection'));

interface PushToGitHubDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onPush: (repoName: string, username?: string, token?: string, isPrivate?: boolean) => Promise<string>;
}

interface GitHubRepo {
  name: string;
  full_name: string;
  html_url: string;
  description: string;
  stargazers_count: number;
  forks_count: number;
  default_branch: string;
  updated_at: string;
  language: string;
  private: boolean;
}

export function PushToGitHubDialog({ isOpen, onClose, onPush }: PushToGitHubDialogProps) {
  const [repoName, setRepoName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<GitHubUserResponse | null>(null);
  const [recentRepos, setRecentRepos] = useState<GitHubRepo[]>([]);
  const [isFetchingRepos, setIsFetchingRepos] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [createdRepoUrl, setCreatedRepoUrl] = useState('');
  const [pushedFiles, setPushedFiles] = useState<{ path: string; size: number }[]>([]);
  const [isGitHubConnected, setIsGitHubConnected] = useState(false);
  const [showConnectionForm, setShowConnectionForm] = useState(false);

  // Load GitHub connection on mount
  useEffect(() => {
    if (isOpen) {
      loadGitHubConnection();
    }
  }, [isOpen, isGitHubConnected]);

  const loadGitHubConnection = () => {
    const connection = getLocalStorage('github_connection');

    if (connection?.user && connection?.token) {
      setUser(connection.user);
      setShowConnectionForm(false);

      // Only fetch if we have both user and token
      if (connection.token.trim()) {
        fetchRecentRepos(connection.token);
      }
    } else {
      setShowConnectionForm(true);
    }
  };

  // 添加检测 GitHub 连接变化的 useEffect
  useEffect(() => {
    // 监听 localStorage 变化
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'github_connection' && e.newValue) {
        try {
          const connection = JSON.parse(e.newValue);
          if (connection?.user && connection?.token) {
            setIsGitHubConnected(true);
            loadGitHubConnection();
          }
        } catch (error) {
          logger.error('Error parsing github_connection from storage event:', error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // 检查 localStorage 变化的函数，在内部组件触发
  const checkGitHubConnection = () => {
    const connection = getLocalStorage('github_connection');
    if (connection?.user && connection?.token) {
      setIsGitHubConnected(true);
      setShowConnectionForm(false);
      loadGitHubConnection();
    }
  };

  const fetchRecentRepos = async (token: string) => {
    if (!token) {
      logStore.logError('No GitHub token available');
      toast.error('GitHub 认证失败');

      return;
    }

    try {
      setIsFetchingRepos(true);

      const response = await fetch(
        'https://api.github.com/user/repos?sort=updated&per_page=5&affiliation=owner,organization_member',
        {
          headers: {
            Accept: 'application/vnd.github.v3+json',
            Authorization: `Bearer ${token.trim()}`,
          },
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 401) {
          toast.error('GitHub 令牌已过期。请重新连接您的账户。');

          // Clear invalid token
          const connection = getLocalStorage('github_connection');

          if (connection) {
            localStorage.removeItem('github_connection');
            setUser(null);
          }
        } else {
          logStore.logError('Failed to fetch GitHub repositories', {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
          });
          toast.error(`无法获取 GitHub 仓库: ${response.statusText}`);
        }

        return;
      }

      const repos = (await response.json()) as GitHubRepo[];
      setRecentRepos(repos);
    } catch (error) {
      logStore.logError('Failed to fetch GitHub repositories', { error });
      toast.error('无法获取最近仓库');
    } finally {
      setIsFetchingRepos(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const connection = getLocalStorage('github_connection');

    if (!connection?.token || !connection?.user) {
      setShowConnectionForm(true);
      return;
    }

    if (!repoName.trim()) {
      toast.error('仓库名称是必需的');
      return;
    }

    setIsLoading(true);

    try {
      // Check if repository exists first
      const octokit = new Octokit({ auth: connection.token });

      try {
        await octokit.repos.get({
          owner: connection.user.login,
          repo: repoName,
        });

        // If we get here, the repo exists
        const confirmOverwrite = window.confirm(
          `仓库 "${repoName}" 已存在。是否要更新它？这将添加或修改仓库中的文件。`,
        );

        if (!confirmOverwrite) {
          setIsLoading(false);
          return;
        }
      } catch (error) {
        // 404 means repo doesn't exist, which is what we want for new repos
        if (error instanceof Error && 'status' in error && error.status !== 404) {
          throw error;
        }
      }

      const repoUrl = await onPush(repoName, connection.user.login, connection.token, isPrivate);
      setCreatedRepoUrl(repoUrl);

      // Get list of pushed files
      const files = await webBuilderStore.getProjectFilesAsMap({
        inline: false,
      });
      const filesList = Object.entries(files).map(([path, content]) => ({
        path,
        size: new TextEncoder().encode(content).length,
      }));

      setPushedFiles(filesList);
      setShowSuccessDialog(true);
    } catch (error) {
      logger.error('Error pushing to GitHub:', error);
      toast.error('推送失败，请检查仓库名称并重试。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setRepoName('');
    setIsPrivate(false);
    setShowSuccessDialog(false);
    setCreatedRepoUrl('');
    setShowConnectionForm(false);
    onClose();
  };

  const handleSwitchAccount = () => {
    setShowConnectionForm(true);
  };

  const handleDisconnect = () => {
    // 清除 localStorage
    localStorage.removeItem('github_connection');
    // 清除 cookie
    document.cookie = 'githubToken=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'githubUsername=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'git:github.com=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    // 更新状态
    setUser(null);
    setShowConnectionForm(true);
    toast.success('已断开与 GitHub 的连接');
  };

  // Success Dialog
  if (showSuccessDialog) {
    return (
      <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <Dialog.Portal>
          <div className="fixed inset-0 flex items-center justify-center z-[100]">
            <Dialog.Overlay asChild>
              <motion.div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </Dialog.Overlay>

            <Dialog.Content
              aria-describedby={undefined}
              onEscapeKeyDown={handleClose}
              onPointerDownOutside={handleClose}
              className="relative z-[101]"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2 }}
                className="w-[90vw] md:w-[600px] my-4"
              >
                <div className="bg-white dark:bg-[#1E1E1E] rounded-lg border border-[#E5E5E5] dark:border-[#333333] shadow-xl max-h-[calc(85vh-2rem)] flex flex-col">
                  <div className="p-6 overflow-y-auto flex-1 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-green-500">
                        <div className="i-ph:check-circle size-5" />
                        <h3 className="text-lg font-medium">成功推送代码至 GitHub</h3>
                      </div>
                      <Dialog.Close
                        onClick={handleClose}
                        className="flex items-center justify-center size-8 rounded-full bg-transparent hover:bg-purple-500/10 dark:hover:bg-purple-500/20 group transition-all duration-200"
                      >
                        <div className="i-ph:x size-4 text-gray-500 dark:text-gray-400 group-hover:text-purple-500 transition-colors" />
                      </Dialog.Close>
                    </div>

                    <div className="bg-upage-elements-background-depth-2 dark:bg-upage-elements-background-depth-3 rounded-lg p-3 text-left">
                      <p className="text-xs text-upage-elements-textSecondary dark:text-upage-elements-textSecondary-dark mb-2">
                        仓库地址
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-sm bg-upage-elements-background dark:bg-upage-elements-background-dark px-3 py-2 rounded border border-upage-elements-borderColor dark:border-upage-elements-borderColor-dark text-upage-elements-textPrimary dark:text-upage-elements-textPrimary-dark font-mono">
                          {createdRepoUrl}
                        </code>
                        <motion.button
                          onClick={() => {
                            navigator.clipboard.writeText(createdRepoUrl);
                            toast.success('URL 已复制到剪贴板');
                          }}
                          className="p-2 rounded-lg bg-[#F5F5F5] dark:bg-[#1A1A1A] text-gray-600 dark:text-gray-400 hover:bg-[#E5E5E5] dark:hover:bg-[#252525] text-sm inline-flex items-center gap-2"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          <div className="i-ph:copy size-4" />
                        </motion.button>
                      </div>
                    </div>

                    <div className="bg-upage-elements-background-depth-2 dark:bg-upage-elements-background-depth-3 rounded-lg p-3">
                      <p className="text-xs text-upage-elements-textSecondary dark:text-upage-elements-textSecondary-dark mb-2">
                        推送的文件 ({pushedFiles.length})
                      </p>
                      <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                        {pushedFiles.map((file) => (
                          <div
                            key={file.path}
                            className="flex items-center justify-between py-1 text-sm text-upage-elements-textPrimary dark:text-upage-elements-textPrimary-dark"
                          >
                            <span className="font-mono truncate flex-1">{file.path}</span>
                            <span className="text-xs text-upage-elements-textSecondary dark:text-upage-elements-textSecondary-dark ml-2">
                              {formatSize(file.size)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border-t border-[#E5E5E5] dark:border-[#333333] bg-white dark:bg-[#1E1E1E] sticky bottom-0">
                    <div className="flex justify-end gap-2">
                      <motion.a
                        href={createdRepoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 rounded-lg bg-purple-500 text-white hover:bg-purple-600 text-sm inline-flex items-center gap-2"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="i-ph:github-logo size-4" />
                        查看仓库
                      </motion.a>
                      <motion.button
                        onClick={() => {
                          navigator.clipboard.writeText(createdRepoUrl);
                          toast.success('URL 已复制到剪贴板');
                        }}
                        className="px-4 py-2 rounded-lg bg-[#F5F5F5] dark:bg-[#1A1A1A] text-gray-600 dark:text-gray-400 hover:bg-[#E5E5E5] dark:hover:bg-[#252525] text-sm inline-flex items-center gap-2"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="i-ph:copy size-4" />
                        复制 URL
                      </motion.button>
                      <motion.button
                        onClick={handleClose}
                        className="px-4 py-2 rounded-lg bg-[#F5F5F5] dark:bg-[#1A1A1A] text-gray-600 dark:text-gray-400 hover:bg-[#E5E5E5] dark:hover:bg-[#252525] text-sm"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        关闭
                      </motion.button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </Dialog.Content>
          </div>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  if (showConnectionForm) {
    return (
      <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <Dialog.Portal>
          <div className="fixed inset-0 flex items-center justify-center z-[100]">
            <Dialog.Overlay asChild>
              <motion.div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </Dialog.Overlay>

            <Dialog.Content
              aria-describedby={undefined}
              onEscapeKeyDown={handleClose}
              onPointerDownOutside={handleClose}
              className="relative z-[101]"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2 }}
                className="w-[90vw] md:w-[650px] my-4"
              >
                <div className="bg-white dark:bg-[#0A0A0A] rounded-lg border border-[#E5E5E5] dark:border-[#1A1A1A] shadow-xl max-h-[calc(85vh-2rem)] flex flex-col">
                  <div className="p-6 overflow-y-auto flex-1">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="i-ph:github-logo size-5 text-purple-500" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                          {showConnectionForm ? 'GitHub 连接信息' : '连接 GitHub 账户'}
                        </h3>
                      </div>
                      <Dialog.Close
                        className="flex items-center justify-center size-8 rounded-full bg-transparent hover:bg-purple-500/10 dark:hover:bg-purple-500/20 group transition-all duration-200"
                        onClick={handleClose}
                      >
                        <div className="i-ph:x size-4 text-gray-500 dark:text-gray-400 group-hover:text-purple-500 transition-colors" />
                      </Dialog.Close>
                    </div>

                    {!showConnectionForm && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        需要连接 GitHub 账户才能将代码推送到 GitHub 仓库。请在此页面完成连接。
                      </p>
                    )}

                    <div className="github-connection-wrapper">
                      <Suspense>
                        <GitHubConnection />
                      </Suspense>
                    </div>
                  </div>

                  <div className="p-4 border-t border-[#E5E5E5] dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] sticky bottom-0">
                    <div className="flex justify-end">
                      {isGitHubConnected || user ? (
                        <motion.button
                          onClick={() => {
                            setShowConnectionForm(false);
                          }}
                          className="px-4 py-2 rounded-lg bg-purple-500 text-white text-sm hover:bg-purple-600 inline-flex items-center gap-2"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className="i-ph:arrow-right" />
                          推送列表
                        </motion.button>
                      ) : (
                        <motion.button
                          onClick={() => {
                            checkGitHubConnection();
                            setTimeout(checkGitHubConnection, 500); // 延迟检查
                          }}
                          className="px-4 py-2 rounded-lg bg-upage-elements-item-backgroundAccent text-upage-elements-item-contentAccent text-sm hover:bg-upage-elements-item-backgroundAccent/90 inline-flex items-center gap-2"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className="i-ph:arrows-clockwise" />
                          刷新连接状态
                        </motion.button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            </Dialog.Content>
          </div>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Portal>
        <div className="fixed inset-0 flex items-center justify-center z-[100]">
          <Dialog.Overlay asChild>
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
          </Dialog.Overlay>

          <Dialog.Content
            aria-describedby={undefined}
            onEscapeKeyDown={handleClose}
            onPointerDownOutside={handleClose}
            className="relative z-[101]"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="w-[90vw] md:w-[500px] my-4"
            >
              <div className="bg-white dark:bg-[#0A0A0A] rounded-lg border border-[#E5E5E5] dark:border-[#1A1A1A] shadow-xl max-h-[calc(85vh-2rem)] flex flex-col">
                <div className="p-6 overflow-y-auto flex-1">
                  <div className="flex items-center gap-4 mb-6">
                    <motion.div
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.1 }}
                      className="size-10 rounded-xl bg-upage-elements-background-depth-3 flex items-center justify-center text-purple-500"
                    >
                      <div className="i-ph:git-branch size-5" />
                    </motion.div>
                    <div>
                      <Dialog.Title className="text-lg font-medium text-gray-900 dark:text-white">
                        推送到 GitHub
                      </Dialog.Title>
                      <p className="text-sm text-gray-600 dark:text-gray-400">将代码推送到新的或现有的 GitHub 仓库</p>
                    </div>
                    <Dialog.Close
                      className="ml-auto flex items-center justify-center size-8 rounded-full bg-transparent hover:bg-purple-500/10 dark:hover:bg-purple-500/20 group transition-all duration-200"
                      onClick={handleClose}
                    >
                      <div className="i-ph:x size-4 text-gray-500 dark:text-gray-400 group-hover:text-purple-500 transition-colors" />
                    </Dialog.Close>
                  </div>
                  {user && (
                    <div className="flex items-center justify-between gap-3 mb-6 p-3 bg-upage-elements-background-depth-2 dark:bg-upage-elements-background-depth-3 rounded-lg">
                      <div className="flex items-center gap-3">
                        <img src={user?.avatar_url} alt={user?.login} className="size-10 rounded-full" />
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {user?.name || user?.login}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">@{user?.login}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <motion.button
                          onClick={handleSwitchAccount}
                          className="px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-800 text-upage-elements-textPrimary dark:text-upage-elements-textPrimary text-sm hover:bg-gray-300 dark:hover:bg-gray-700 inline-flex items-center gap-1"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className="i-ph:chart-bar size-4" />
                          查看统计
                        </motion.button>
                        <motion.button
                          onClick={handleDisconnect}
                          className="px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm hover:bg-red-600 inline-flex items-center gap-1"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className="i-ph:sign-out size-4" />
                          断开连接
                        </motion.button>
                      </div>
                    </div>
                  )}
                  <form id="github-push-form" onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <label htmlFor="repoName" className="text-sm text-gray-600 dark:text-gray-400">
                        仓库名称
                      </label>
                      <input
                        id="repoName"
                        type="text"
                        value={repoName}
                        onChange={(e) => setRepoName(e.target.value)}
                        placeholder="my-awesome-project"
                        className="w-full px-4 py-2 rounded-lg bg-upage-elements-background-depth-2 dark:bg-upage-elements-background-depth-3 border border-[#E5E5E5] dark:border-[#1A1A1A] text-gray-900 dark:text-white placeholder-gray-400"
                        required
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="private"
                        checked={isPrivate}
                        onChange={(e) => setIsPrivate(e.target.checked)}
                        className="rounded border-[#E5E5E5] dark:border-[#1A1A1A] text-purple-500 focus:ring-purple-500 dark:bg-[#0A0A0A]"
                      />
                      <label htmlFor="private" className="text-sm text-gray-600 dark:text-gray-400">
                        将仓库设置为私有
                      </label>
                    </div>

                    {recentRepos.length > 0 && (
                      <div className="space-y-2">
                        <label className="text-sm text-gray-600 dark:text-gray-400">最近仓库</label>
                        <div className="space-y-2">
                          {recentRepos.map((repo) => (
                            <motion.button
                              key={repo.full_name}
                              type="button"
                              onClick={() => setRepoName(repo.name)}
                              className="w-full p-3 text-left rounded-lg bg-upage-elements-background-depth-2 dark:bg-upage-elements-background-depth-3 hover:bg-upage-elements-background-depth-3 dark:hover:bg-upage-elements-background-depth-4 transition-colors group"
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.99 }}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="i-mingcute:github-line size-4 text-purple-500" />
                                  <span className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-purple-500">
                                    {repo.name}
                                  </span>
                                </div>
                                {repo.private && (
                                  <span className="text-xs px-2 py-1 rounded-full bg-purple-500/10 text-purple-500">
                                    Private
                                  </span>
                                )}
                              </div>
                              {repo.description && (
                                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                                  {repo.description}
                                </p>
                              )}
                              <div className="mt-2 flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                                {repo.language && (
                                  <span className="flex items-center gap-1">
                                    <div className="i-mingcute:code-line size-3" />
                                    {repo.language}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <div className="i-ph:star size-3" />
                                  {repo.stargazers_count.toLocaleString()}
                                </span>
                                <span className="flex items-center gap-1">
                                  <div className="i-ph:git-fork size-3" />
                                  {repo.forks_count.toLocaleString()}
                                </span>
                                <span className="flex items-center gap-1">
                                  <div className="i-ph:clock size-3" />
                                  {new Date(repo.updated_at).toLocaleDateString()}
                                </span>
                              </div>
                            </motion.button>
                          ))}
                        </div>
                      </div>
                    )}

                    {isFetchingRepos && (
                      <div className="flex items-center justify-center py-4 text-gray-500 dark:text-gray-400">
                        <div className="i-ph:spinner-gap-bold animate-spin size-4 mr-2" />
                        正在加载仓库...
                      </div>
                    )}
                  </form>
                </div>

                <div className="p-4 border-t border-[#E5E5E5] dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] sticky bottom-0">
                  <div className="flex gap-2">
                    <motion.button
                      type="button"
                      onClick={handleClose}
                      className="px-4 py-2 rounded-lg bg-[#F5F5F5] dark:bg-[#1A1A1A] text-gray-600 dark:text-gray-400 hover:bg-[#E5E5E5] dark:hover:bg-[#252525] text-sm"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      取消
                    </motion.button>
                    <motion.button
                      type="submit"
                      form="github-push-form"
                      disabled={isLoading}
                      className={classNames(
                        'flex-1 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 text-sm inline-flex items-center justify-center gap-2',
                        isLoading ? 'opacity-50 cursor-not-allowed' : '',
                      )}
                      whileHover={!isLoading ? { scale: 1.02 } : {}}
                      whileTap={!isLoading ? { scale: 0.98 } : {}}
                    >
                      {isLoading ? (
                        <>
                          <div className="i-ph:spinner-gap-bold animate-spin size-4" />
                          正在推送...
                        </>
                      ) : (
                        <>
                          <div className="i-ph:git-branch size-4" />
                          推送到 GitHub
                        </>
                      )}
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
