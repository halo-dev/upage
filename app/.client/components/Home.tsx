import * as Tooltip from '@radix-ui/react-tooltip';
import { useNavigate } from '@remix-run/react';
import { generateId } from 'ai';
import classNames from 'classnames';
import { AnimatePresence, motion, useAnimate } from 'framer-motion';
import { startTransition, useState } from 'react';
import { ChatTextarea } from './chat/ChatTextarea';
import { ExamplePrompts } from './chat/ExamplePrompts';
import FilePreview from './chat/FilePreview';
import { ScreenshotStateManager } from './chat/ScreenshotStateManager';

export function Home({ className }: { className?: string }) {
  const navigate = useNavigate();

  const [animationScope] = useAnimate();
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [isNavigating, setIsNavigating] = useState(false);

  const handleSendMessage = (message?: string) => {
    if (!message) {
      return;
    }

    setIsNavigating(true);

    const id = generateId();

    startTransition(() => {
      navigate(`/chat/${id}`, {
        state: { message, files: uploadFiles },
        preventScrollReset: true,
      });
    });
  };

  return (
    <>
      {isNavigating && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/20 backdrop-blur-sm">
          <div className="relative w-6 h-6">
            <div className="absolute inset-0 border-2 border-blue-500/30 rounded-full"></div>
            <div className="absolute inset-0 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      )}
      {
        <Tooltip.Provider delayDuration={200}>
          <div ref={animationScope} className={classNames('relative flex', className)}>
            <div className="flex flex-col lg:flex-row w-full">
              <div className="flex flex-col flex-grow lg:w-[var(--chat-width)] w-full">
                <AnimatePresence>
                  <motion.div
                    className="mt-[18vh]"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.2 } }}
                  >
                    <div className="max-w-chat mx-auto text-center px-4 lg:px-0">
                      <h1 className="text-3xl lg:text-6xl font-bold text-upage-elements-textPrimary mb-4 animate-fade-in">
                        使用 UPage 构建网站
                      </h1>
                      <p className="text-md lg:text-xl mb-8 text-upage-elements-textSecondary animate-fade-in animation-delay-200">
                        将想法快速转变成现实，并通过可视化实时呈现。
                      </p>
                    </div>
                  </motion.div>
                </AnimatePresence>
                <div className="pt-6 px-1 sm:px-2">
                  <div className="flex flex-col gap-4 w-full max-w-chat mx-auto z-prompt mb-6">
                    <div
                      className={classNames(
                        'bg-upage-elements-background-depth-2 p-1 rounded-lg border border-upage-elements-borderColor relative w-full max-w-chat mx-auto z-prompt',
                      )}
                    >
                      <FilePreview
                        files={uploadFiles}
                        onRemove={(index: number) => {
                          setUploadFiles?.(uploadFiles.filter((_, i) => i !== index));
                        }}
                      />
                      <ScreenshotStateManager uploadFiles={uploadFiles} setUploadFiles={setUploadFiles} />
                      <ChatTextarea
                        onSendMessage={handleSendMessage}
                        uploadFiles={uploadFiles}
                        setUploadFiles={setUploadFiles}
                      />
                    </div>
                  </div>
                </div>
                <AnimatePresence>
                  <motion.div
                    className="flex flex-col justify-center gap-5"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, transition: { duration: 0.2 } }}
                  >
                    <ExamplePrompts
                      sendMessage={(_event, messageInput) => {
                        handleSendMessage?.(messageInput);
                      }}
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </Tooltip.Provider>
      }
    </>
  );
}
