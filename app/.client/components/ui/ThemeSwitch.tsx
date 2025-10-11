import { useStore } from '@nanostores/react';
import { AnimatePresence, motion } from 'framer-motion';
import { memo, useEffect, useState } from 'react';
import { cubicEasingFn } from '~/.client/utils/easings';
import { themeStore, toggleTheme } from '~/stores/theme';
import { IconButton } from './IconButton';

interface ThemeSwitchProps {
  className?: string;
}

export const ThemeSwitch = memo(({ className }: ThemeSwitchProps) => {
  const theme = useStore(themeStore);
  const [domLoaded, setDomLoaded] = useState(false);

  useEffect(() => {
    setDomLoaded(true);
  }, []);

  return (
    domLoaded && (
      <IconButton className={className} title="切换主题" onClick={toggleTheme}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={theme}
            initial={{ rotateZ: -30, opacity: 0 }}
            animate={{ rotateZ: 0, opacity: 1 }}
            exit={{ rotateZ: 30, opacity: 0 }}
            transition={{ duration: 0.3, ease: cubicEasingFn }}
            className={theme === 'dark' ? 'i-mingcute:sun-line text-xl' : 'i-mingcute:moon-line text-xl'}
          />
        </AnimatePresence>
      </IconButton>
    )
  );
});
