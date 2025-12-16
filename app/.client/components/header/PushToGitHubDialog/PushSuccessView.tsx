import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { formatFileSize } from '~/utils/file-utils';

interface PushSuccessViewProps {
  repoUrl: string;
  pushedFiles: Array<{ path: string; size: number }>;
  onClose: () => void;
}

export function PushSuccessView({ repoUrl, pushedFiles, onClose }: PushSuccessViewProps) {
  const handleCopyUrl = () => {
    navigator.clipboard.writeText(repoUrl);
    toast.success('URL 已复制到剪贴板');
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-green-500">
          <div className="i-ph:check-circle size-5" />
          <h3 className="text-lg font-medium">成功推送代码至 GitHub</h3>
        </div>

        <div className="bg-upage-elements-background-depth-2 dark:bg-upage-elements-background-depth-3 rounded-lg p-3 text-left">
          <p className="text-xs text-upage-elements-textSecondary dark:text-upage-elements-textSecondary-dark mb-2">
            仓库地址
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm bg-upage-elements-background dark:bg-upage-elements-background-dark px-3 py-2 rounded border border-upage-elements-borderColor dark:border-upage-elements-borderColor-dark text-upage-elements-textPrimary dark:text-upage-elements-textPrimary-dark font-mono">
              {repoUrl}
            </code>
            <motion.button
              onClick={handleCopyUrl}
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
                  {formatFileSize(file.size)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-6">
        <motion.a
          href={repoUrl}
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
          onClick={handleCopyUrl}
          className="px-4 py-2 rounded-lg bg-[#F5F5F5] dark:bg-[#1A1A1A] text-gray-600 dark:text-gray-400 hover:bg-[#E5E5E5] dark:hover:bg-[#252525] text-sm inline-flex items-center gap-2"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <div className="i-ph:copy size-4" />
          复制 URL
        </motion.button>
        <motion.button
          onClick={onClose}
          className="px-4 py-2 rounded-lg bg-[#F5F5F5] dark:bg-[#1A1A1A] text-gray-600 dark:text-gray-400 hover:bg-[#E5E5E5] dark:hover:bg-[#252525] text-sm"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          关闭
        </motion.button>
      </div>
    </>
  );
}
