import * as Dialog from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import React from 'react';

interface DialogContainerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
  showCloseButton?: boolean;
}

export function DialogContainer({
  isOpen,
  onClose,
  title,
  icon,
  children,
  footer,
  width = 'md:w-[650px]',
  showCloseButton = true,
}: DialogContainerProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
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
            onEscapeKeyDown={onClose}
            onPointerDownOutside={onClose}
            className="relative z-[101]"
          >
            <Dialog.Title className="sr-only">{title}</Dialog.Title>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className={`w-[90vw] ${width} my-4`}
            >
              <div className="bg-white dark:bg-[#1E1E1E] rounded-lg border border-[#E5E5E5] dark:border-[#333333] shadow-xl max-h-[calc(85vh-2rem)] flex flex-col">
                <div className="p-6 overflow-y-auto flex-1">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                      {icon}
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">{title}</h3>
                    </div>
                    {showCloseButton && (
                      <Dialog.Close
                        onClick={onClose}
                        className="flex items-center justify-center size-8 rounded-full bg-transparent hover:bg-purple-500/10 dark:hover:bg-purple-500/20 group transition-all duration-200"
                      >
                        <div className="i-ph:x size-4 text-gray-500 dark:text-gray-400 group-hover:text-purple-500 transition-colors" />
                      </Dialog.Close>
                    )}
                  </div>

                  {children}
                </div>

                {footer && (
                  <div className="p-4 border-t border-[#E5E5E5] dark:border-[#333333] bg-white dark:bg-[#1E1E1E] sticky bottom-0">
                    {footer}
                  </div>
                )}
              </div>
            </motion.div>
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
