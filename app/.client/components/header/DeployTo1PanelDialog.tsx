import { useStore } from '@nanostores/react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import _1PanelConnection from '~/.client/components/header/connections/_1PanelConnection';
import { useChatDeployment } from '~/.client/hooks/useChatDeployment';
import { _1PanelConnectionStore } from '~/.client/stores/1panel';
import { DeploymentPlatformEnum } from '~/types/deployment';

interface DeployTo1PanelDialogProps {
  isOpen: boolean;
  deploying: boolean;
  onClose: () => void;
  onDeploy: (options?: { customDomain?: string; siteId?: number; protocol?: string }) => Promise<void>;
}

export function DeployTo1PanelDialog({ deploying, isOpen, onClose, onDeploy }: DeployTo1PanelDialogProps) {
  const { getDeploymentByPlatform } = useChatDeployment();

  const connection = useStore(_1PanelConnectionStore);
  const [is1PanelConnected, setIs1PanelConnected] = useState(false);
  const [showConnectionForm, setShowConnectionForm] = useState(false);
  const [customDomain, setCustomDomain] = useState('');
  const [proxyProtocol, setProxyProtocol] = useState('http');

  useEffect(() => {
    if (connection.isConnect) {
      setIs1PanelConnected(true);
      if (isOpen && !is1PanelConnected && !showConnectionForm) {
        setShowConnectionForm(false);
      }
      return;
    }
    setIs1PanelConnected(false);
    if (isOpen && !showConnectionForm) {
      setShowConnectionForm(true);
    }
  }, [connection.isConnect, isOpen, is1PanelConnected]);

  const check1PanelConnection = () => {
    if (connection.isConnect) {
      setIs1PanelConnected(true);
    }
  };

  const handleDeploy = async (options?: { customDomain?: string; siteId?: number; protocol?: string }) => {
    if (!connection.isConnect) {
      return;
    }

    await onDeploy({
      ...options,
      customDomain: customDomain || undefined,
      protocol: proxyProtocol,
    });
  };

  const toggleProtocol = () => {
    setProxyProtocol(proxyProtocol === 'http' ? 'https' : 'http');
  };

  const handleClose = () => {
    if (!deploying) {
      onClose();
      setShowConnectionForm(false);
    }
  };

  const deploymentInfo = getDeploymentByPlatform(DeploymentPlatformEnum._1PANEL);

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
            <Dialog.Title className="sr-only">部署到 1Panel</Dialog.Title>
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
                      <img src="/icons/1panel.png" alt="1Panel" className="size-5" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        {is1PanelConnected ? '部署到 1Panel' : '连接 1Panel 服务器'}
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
                    {is1PanelConnected
                      ? '您的项目将被部署到 1Panel。点击"部署"按钮开始部署。'
                      : '需要连接 1Panel 服务器才能部署项目。请在此页面完成连接。'}
                  </p>

                  {!is1PanelConnected && (
                    <p className="text-sm font-medium text-amber-600 dark:text-amber-500 mb-6 flex items-center gap-1.5">
                      <span className="i-ph:warning-circle size-4 flex-shrink-0" />
                      仅适用于 1Panel V2 版本
                    </p>
                  )}

                  {is1PanelConnected && !deploymentInfo?.id && (
                    <div className="mb-6">
                      <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">自定义域名（可选）</label>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={toggleProtocol}
                          className="px-3 py-2 rounded-lg text-sm bg-[#F8F8F8] dark:bg-[#1A1A1A] border border-[#E5E5E5] dark:border-[#333333] text-gray-900 dark:text-white hover:bg-[#F0F0F0] dark:hover:bg-[#222222] transition-colors focus:outline-none focus:ring-1 focus:ring-upage-elements-borderColorActive"
                        >
                          {proxyProtocol}
                        </button>
                        <span className="text-gray-500 dark:text-gray-400">://</span>
                        <input
                          type="text"
                          value={customDomain}
                          onChange={(e) => setCustomDomain(e.target.value)}
                          placeholder="example.upage.ai"
                          className="flex-1 px-3 py-2 rounded-lg text-sm bg-[#F8F8F8] dark:bg-[#1A1A1A] border border-[#E5E5E5] dark:border-[#333333] text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-upage-elements-borderColorActive"
                        />
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">留空将使用自动生成的域名</p>
                    </div>
                  )}

                  <div className="1panel-connection-wrapper">
                    <_1PanelConnection isDeploying={deploying} onDeploy={(siteId) => handleDeploy({ siteId })} />
                  </div>
                </div>

                <div className="p-4 border-t border-[#E5E5E5] dark:border-[#1A1A1A] bg-white dark:bg-[#0A0A0A] sticky bottom-0">
                  <div className="flex justify-end">
                    {!is1PanelConnected ? (
                      <motion.button
                        onClick={() => {
                          check1PanelConnection();
                          setTimeout(check1PanelConnection, 500);
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
                        onClick={() => handleDeploy()}
                        disabled={deploying}
                        className="px-4 py-2 rounded-lg bg-[#2b5fe3] text-white text-sm hover:bg-[#2b5fe3]/90 inline-flex items-center gap-2"
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
                            {!!deploymentInfo?.id ? '覆盖已有网站' : '部署到 1Panel'}
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
