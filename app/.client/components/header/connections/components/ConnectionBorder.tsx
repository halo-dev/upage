import classNames from 'classnames';
import { motion } from 'framer-motion';

export default function ConnectionBorder({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className={classNames(
        'bg-upage-elements-background dark:bg-upage-elements-background border border-upage-elements-borderColor dark:border-upage-elements-borderColor rounded-lg',
        className,
      )}
    >
      <div className="p-6 space-y-6">{children}</div>
    </motion.div>
  );
}
