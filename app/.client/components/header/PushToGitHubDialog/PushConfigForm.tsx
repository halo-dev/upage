import { motion } from 'framer-motion';
import React, { useEffect } from 'react';
import { useChatDeployment } from '~/.client/hooks/useChatDeployment';
import { DeploymentPlatformEnum } from '~/types/deployment';

interface PushConfigFormProps {
  repoName: string;
  setRepoName: (name: string) => void;
  commitMessage: string;
  setCommitMessage: (message: string) => void;
  isPrivate: boolean;
  setIsPrivate: (isPrivate: boolean) => void;
  isLoading: boolean;
  onSubmit: (e: React.FormEvent) => Promise<void>;
  onCancel: () => void;
}

export function PushConfigForm({
  repoName,
  setRepoName,
  commitMessage,
  setCommitMessage,
  isPrivate,
  setIsPrivate,
  isLoading,
  onSubmit,
  onCancel,
}: PushConfigFormProps) {
  const { getDeploymentByPlatform } = useChatDeployment();
  const deploymentInfo = getDeploymentByPlatform(DeploymentPlatformEnum.GITHUB);

  useEffect(() => {
    const metadata = deploymentInfo?.metadata as { repoName?: string; private?: boolean };
    if (metadata.repoName) {
      setRepoName(metadata.repoName);
    }
    if (metadata.private !== undefined) {
      setIsPrivate(metadata.private || false);
    }
  }, [deploymentInfo]);

  return (
    <form onSubmit={onSubmit}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            仓库名称 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={repoName}
            onChange={(e) => setRepoName(e.target.value)}
            placeholder="例如：my-awesome-project"
            className="w-full px-3 py-2 bg-white text-sm dark:bg-[#0A0A0A] border border-[#E5E5E5] dark:border-[#333333] rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            disabled={isLoading}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">只能包含字母、数字、连字符和下划线</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            提交信息 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="描述本次提交的内容..."
            rows={3}
            className="w-full px-3 py-2 bg-white text-sm dark:bg-[#0A0A0A] border border-[#E5E5E5] dark:border-[#333333] rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            disabled={isLoading}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isPrivate"
            checked={isPrivate}
            onChange={(e) => setIsPrivate(e.target.checked)}
            className="w-4 h-4 text-purple-500 bg-white dark:bg-[#0A0A0A] border-[#E5E5E5] dark:border-[#333333] rounded focus:ring-purple-500 focus:ring-2"
            disabled={isLoading}
          />
          <label htmlFor="isPrivate" className="text-sm text-gray-700 dark:text-gray-300">
            私有仓库
          </label>
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-6">
        <motion.button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-lg bg-[#F5F5F5] dark:bg-[#1A1A1A] text-gray-600 dark:text-gray-400 hover:bg-[#E5E5E5] dark:hover:bg-[#252525] text-sm"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          disabled={isLoading}
        >
          取消
        </motion.button>
        <motion.button
          type="submit"
          className="px-4 py-2 rounded-lg bg-purple-500 text-white hover:bg-purple-600 text-sm inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          whileHover={{ scale: isLoading ? 1 : 1.02 }}
          whileTap={{ scale: isLoading ? 1 : 0.98 }}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <div className="i-ph:circle-notch size-4 animate-spin" />
              推送中...
            </>
          ) : (
            <>
              <div className="i-ph:git-branch size-4" />
              确认推送
            </>
          )}
        </motion.button>
      </div>
    </form>
  );
}
