import { useStore } from '@nanostores/react';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import classNames from 'classnames';
import { useMemo } from 'react';
import { ChatDescription } from '~/.client/components/header/ChatDescription';
import { ThemeSwitch } from '~/.client/components/ui/ThemeSwitch';
import { useAuth } from '~/.client/hooks/useAuth';
import { aiState } from '~/.client/stores/ai-state';
import { themeStore } from '~/stores/theme';
import { HeaderActionButtons } from '../header/HeaderActionButtons';
import { MinimalAvatarDropdown } from '../header/MinimalAvatarDropdown';
import { HistorySwitch } from '../sidebar/HistorySwitch';

export function Header({ className, isScrolled }: { className?: string; isScrolled?: boolean }) {
  const { isAuthenticated } = useAuth();
  const theme = useStore(themeStore);
  const logoSrc = useMemo(() => (theme === 'dark' ? '/logo-dark.png' : '/logo.png'), [theme]);

  const { chatStarted } = useStore(aiState);

  return (
    <TooltipProvider>
      <header
        className={classNames(
          'flex items-center justify-between px-3 py-2 gap-3 shrink-0 border-b',
          'transition-colors duration-200',
          className,
          {
            'border-transparent': !chatStarted,
            'border-upage-elements-borderColor': chatStarted,
            'bg-upage-elements-background-depth-1': isScrolled,
            'bg-transparent': !isScrolled,
          },
        )}
      >
        <div className="flex items-center gap-2 z-logo text-upage-elements-textPrimary cursor-pointer">
          <a href="/" className="text-xl font-semibold text-accent flex items-center">
            <picture>
              <img src={logoSrc} alt="UPage Logo" className="h-6" />
            </picture>
          </a>
          <div className="flex gap-1">
            {isAuthenticated && <HistorySwitch />}
            <ThemeSwitch />
          </div>
        </div>

        <div className="flex-1 px-4 truncate text-center text-upage-elements-textPrimary">
          {chatStarted && <ChatDescription />}
        </div>

        <div className="flex items-center gap-2 justify-end">
          {chatStarted && (
            <>
              <div className="mr-1">
                <HeaderActionButtons />
              </div>
            </>
          )}
          <MinimalAvatarDropdown />
        </div>
      </header>
    </TooltipProvider>
  );
}
