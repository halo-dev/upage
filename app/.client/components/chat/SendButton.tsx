import { AnimatePresence, cubicBezier, motion } from 'framer-motion';

interface SendButtonProps {
  show: boolean;
  isRunning?: boolean;
  disabled?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
  onImagesSelected?: (images: File[]) => void;
}

const customEasingFn = cubicBezier(0.4, 0, 0.2, 1);

export const SendButton = ({ show, isRunning, disabled, onClick }: SendButtonProps) => {
  return (
    <AnimatePresence>
      {show ? (
        <motion.button
          className="absolute top-[18px] right-[22px] flex h-[34px] w-[34px] items-center justify-center rounded-md bg-accent-500 p-1 text-white transition-theme transition-text-color transition-background transition-border hover:brightness-94 disabled:cursor-not-allowed disabled:opacity-50"
          transition={{ ease: customEasingFn, duration: 0.17 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          disabled={disabled}
          onClick={(event) => {
            event.preventDefault();

            if (!disabled) {
              onClick?.(event);
            }
          }}
        >
          <div className="text-lg">
            {!isRunning ? (
              <div className="i-mingcute:arrow-right-line"></div>
            ) : (
              <div className="i-mingcute:stop-circle-line"></div>
            )}
          </div>
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
};
