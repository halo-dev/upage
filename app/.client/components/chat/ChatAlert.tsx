import { useStore } from '@nanostores/react';
import classNames from 'classnames';
import { AnimatePresence, motion } from 'framer-motion';
import { useCallback, useMemo } from 'react';
import { webBuilderStore } from '~/.client/stores/web-builder';

interface Props {
  postMessage: (message: string) => void;
}

export default function ChatAlert({ postMessage }: Props) {
  const actionAlert = useStore(webBuilderStore.chatStore.alert);

  const { description, content } = useMemo(() => actionAlert ?? { description: '', content: '' }, [actionAlert]);

  const handlePostMessage = useCallback(
    (message: string) => {
      postMessage(message);
      handleClearAlert();
    },
    [postMessage],
  );

  const handleClearAlert = useCallback(() => {
    webBuilderStore.chatStore.clearAlert();
  }, [webBuilderStore]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className={`rounded-lg border border-upage-elements-borderColor bg-upage-elements-background-depth-2 p-4 mb-2`}
      >
        <div className="flex items-start">
          {/* Icon */}
          <motion.div
            className="flex-shrink-0"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className={`i-ph:warning-duotone text-xl text-upage-elements-button-danger-text`}></div>
          </motion.div>
          {/* Content */}
          <div className="ml-3 flex-1">
            <motion.h3
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              className={`text-sm font-medium text-upage-elements-textPrimary`}
            >
              预览错误
            </motion.h3>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className={`mt-2 text-sm text-upage-elements-textSecondary`}
            >
              <p>我们遇到了预览错误。是否想让 UPage 分析并帮助解决这个问题？</p>
              {description && (
                <div className="text-xs text-upage-elements-textSecondary p-2 bg-upage-elements-background-depth-3 rounded mt-4 mb-4">
                  Error: {description}
                </div>
              )}
            </motion.div>

            {/* Actions */}
            <motion.div
              className="mt-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <div className={classNames(' flex gap-2')}>
                <button
                  onClick={() => handlePostMessage(`*Fix this preview error* \n\`\`\`js\n${content}\n\`\`\`\n`)}
                  className={classNames(
                    `px-2 py-1.5 rounded-md text-sm font-medium`,
                    'bg-upage-elements-button-primary-background',
                    'hover:bg-upage-elements-button-primary-backgroundHover',
                    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-upage-elements-button-danger-background',
                    'text-upage-elements-button-primary-text',
                    'flex items-center gap-1.5',
                  )}
                >
                  <div className="i-ph:chat-circle-duotone"></div>
                  询问 UPage
                </button>
                <button
                  onClick={handleClearAlert}
                  className={classNames(
                    `px-2 py-1.5 rounded-md text-sm font-medium`,
                    'bg-upage-elements-button-secondary-background',
                    'hover:bg-upage-elements-button-secondary-backgroundHover',
                    'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-upage-elements-button-secondary-background',
                    'text-upage-elements-button-secondary-text',
                  )}
                >
                  忽略
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
