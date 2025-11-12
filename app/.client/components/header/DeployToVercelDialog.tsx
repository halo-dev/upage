import { useStore } from '@nanostores/react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import VercelConnection from '~/.client/components/header/connections/VercelConnection';
import { useChatDeployment } from '~/.client/hooks/useChatDeployment';
import { vercelConnection } from '~/.client/stores/vercel';
import { DeploymentPlatformEnum } from '~/types/deployment';

interface DeployToVercelDialogProps {
  isOpen: boolean;
  deploying: boolean;
  onClose: () => void;
  onDeploy: () => Promise<void>;
}

export function DeployToVercelDialog({ deploying, isOpen, onClose, onDeploy }: DeployToVercelDialogProps) {
  const { getDeploymentByPlatform } = useChatDeployment();
  const connection = useStore(vercelConnection);
  const [isVercelConnected, setIsVercelConnected] = useState(false);
  const [showConnectionForm, setShowConnectionForm] = useState(false);

  useEffect(() => {
    if (connection.user) {
      setIsVercelConnected(true);
      if (isOpen && !isVercelConnected && !showConnectionForm) {
        setShowConnectionForm(false);
      }
    } else {
      setIsVercelConnected(false);
      if (isOpen && !showConnectionForm) {
        setShowConnectionForm(true);
      }
    }
  }, [connection.user, isOpen, isVercelConnected]);

  const checkVercelConnection = () => {
    if (connection.user) {
      setIsVercelConnected(true);
    }
  };

  const handleDeploy = async () => {
    if (!connection.user) {
      return;
    }
    onDeploy();
  };

  const handleClose = () => {
    if (!deploying) {
      onClose();
      setShowConnectionForm(false);
    }
  };

  const deploymentInfo = getDeploymentByPlatform(DeploymentPlatformEnum.VERCEL);

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
            <Dialog.Title className="sr-only">部署到 Vercel</Dialog.Title>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="w-[90vw] md:w-[650px] my-4"
            >
              <div className="bg-white dark:bg-gray-950 border border-gray-200/50 dark:border-gray-800/50 rounded-lg shadow-lg max-h-[calc(85vh-2rem)] flex flex-col">
                <div className="p-6 overflow-y-auto flex-1">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="i-skill-icons:vercel-light size-5"></div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        {connection.user ? '部署到 Vercel' : '连接 Vercel 账户'}
                      </h3>
                    </div>
                    <Dialog.Close
                      className="flex items-center justify-center size-8 rounded-full bg-transparent hover:bg-purple-500/10 dark:hover:bg-purple-500/20 group transition-all duration-200"
                      onClick={handleClose}
                    >
                      <div className="i-ph:x size-4 text-gray-500 dark:text-gray-400 group-hover:text-purple-500 transition-colors" />
                    </Dialog.Close>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    {isVercelConnected
                      ? '您的项目将被部署到 Vercel。点击"部署"按钮开始部署。'
                      : '需要连接 Vercel 账户才能部署项目。请在此页面完成连接。'}
                  </p>

                  <div className="vercel-connection-wrapper">
                    <VercelConnection />
                  </div>
                </div>

                <div className="p-4 border-t border-[#E5E5E5] dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] sticky bottom-0">
                  <div className="flex justify-end">
                    {!isVercelConnected ? (
                      <motion.button
                        onClick={() => {
                          checkVercelConnection();
                          setTimeout(checkVercelConnection, 500);
                        }}
                        className="px-4 py-2 rounded-lg bg-upage-elements-item-backgroundAccent text-upage-elements-item-contentAccent text-sm hover:bg-upage-elements-item-backgroundAccent/90 inline-flex items-center gap-2"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <div className="i-ph:arrows-clockwise" />
                        刷新连接状态
                      </motion.button>
                    ) : (
                      <motion.button
                        onClick={handleDeploy}
                        disabled={deploying}
                        className="px-4 py-2 rounded-lg bg-black dark:bg-white dark:text-black text-white text-sm hover:bg-gray-800 dark:hover:bg-gray-200 inline-flex items-center gap-2"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {deploying ? (
                          <>
                            <div className="i-ph:spinner-gap animate-spin size-4" />
                            部署中...
                          </>
                        ) : (
                          <>
                            <div className="i-ph:rocket-launch size-4" />
                            {!!deploymentInfo?.id ? '覆盖已有网站' : '部署到 Vercel'}
                          </>
                        )}
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
