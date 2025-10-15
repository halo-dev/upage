import { motion } from 'framer-motion';
import React, { Suspense } from 'react';

const GitHubConnection = React.lazy(() => import('~/.client/components/header/connections/GithubConnection'));

interface GitHubConnectionViewProps {
  isConnected: boolean;
  onPushClick: () => void;
}

export function GitHubConnectionView({ isConnected, onPushClick }: GitHubConnectionViewProps) {
  return (
    <>
      {!isConnected && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          需要连接 GitHub 账户才能将代码推送到 GitHub 仓库。请在此页面完成连接。
        </p>
      )}

      <div className="github-connection-wrapper">
        <Suspense>
          <GitHubConnection />
        </Suspense>
      </div>

      {isConnected && (
        <div className="flex justify-end mt-4">
          <motion.button
            onClick={onPushClick}
            className="px-4 py-2 rounded-lg bg-purple-500 text-white text-sm hover:bg-purple-600 inline-flex items-center gap-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="i-ph:github-logo size-4" />
            推送至 GitHub
          </motion.button>
        </div>
      )}
    </>
  );
}
