import classNames from 'classnames';
import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { cubicEasingFn } from '~/.client/utils/easings';
import type { ProgressAnnotation } from '~/types/message';

export default function ProgressCompilation({ data }: { data?: ProgressAnnotation[] }) {
  const [expanded, setExpanded] = useState(false);

  const progressList = useMemo(() => {
    if (!data || data.length == 0) {
      return [];
    }
    const progressMap = new Map<string, ProgressAnnotation>();
    data.forEach((x) => {
      const existingProgress = progressMap.get(x.label);

      if (existingProgress && existingProgress.status === 'complete') {
        return;
      }

      progressMap.set(x.label, x);
    });

    return Array.from(progressMap.values()).sort((a, b) => a.order - b.order);
  }, [data]);

  if (progressList.length === 0) {
    return <></>;
  }

  return (
    <AnimatePresence>
      <div
        className={classNames(
          'bg-upage-elements-background-depth-2',
          'border border-upage-elements-borderColor',
          'shadow-lg rounded-lg  relative w-full max-w-chat mx-auto z-prompt',
          'p-1',
        )}
      >
        <div
          className={classNames(
            'bg-upage-elements-item-backgroundAccent',
            'py-1 px-1.5 rounded-md text-upage-elements-item-contentAccent',
            'flex items-center',
          )}
        >
          <div className="flex-1">
            <AnimatePresence>
              {expanded ? (
                <motion.div
                  className="actions"
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: '0px' }}
                  transition={{ duration: 0.15 }}
                >
                  {progressList.map((x, i) => {
                    return <ProgressItem key={i} progress={x} />;
                  })}
                </motion.div>
              ) : (
                <ProgressItem progress={progressList.slice(-1)[0]} />
              )}
            </AnimatePresence>
          </div>
          {progressList.length > 1 && (
            <motion.button
              initial={{ width: 0 }}
              animate={{ width: 'auto' }}
              exit={{ width: 0 }}
              transition={{ duration: 0.15, ease: cubicEasingFn }}
              className="p-1 rounded-lg bg-upage-elements-item-backgroundAccent hover:bg-upage-elements-artifacts-backgroundHover"
              onClick={() => setExpanded((v) => !v)}
            >
              <div className={expanded ? 'i-ph:caret-up-bold' : 'i-ph:caret-down-bold'}></div>
            </motion.button>
          )}
        </div>
      </div>
    </AnimatePresence>
  );
}

interface ProgressItemProps {
  progress: ProgressAnnotation;
}

const ProgressItem = ({ progress }: ProgressItemProps) => {
  return (
    <motion.div
      className={classNames('flex text-sm gap-3 items-center justify-between', {
        'text-upage-elements-textSuccess': progress.status === 'complete',
        'text-upage-elements-textError': progress.status === 'stopped',
      })}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      <div className="flex items-center gap-1.5">
        <div>
          {progress.status === 'in-progress' ? (
            <div className="i-svg-spinners:90-ring-with-bg"></div>
          ) : progress.status === 'complete' ? (
            <div className="i-ph:check"></div>
          ) : progress.status === 'stopped' ? (
            <div className="i-ph:x"></div>
          ) : progress.status === 'warning' ? (
            <div className="i-ph:warning"></div>
          ) : null}
        </div>
        {progress.message}
      </div>
    </motion.div>
  );
};
