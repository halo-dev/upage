import { useStore } from '@nanostores/react';
import classNames from 'classnames';
import { useMemo } from 'react';
import { ClientOnly } from 'remix-utils/client-only';
import { useAuth } from '~/lib/hooks';
import { aiState } from '~/lib/stores/ai-state';
import { themeStore } from '~/lib/stores/theme';
import { HistorySwitch } from '../sidebar/HistorySwitch';
import { ThemeSwitch } from '../ui/ThemeSwitch';
import { ChatDescription } from './ChatDescription.client';
import { HeaderActionButtons } from './HeaderActionButtons';
import { MinimalAvatarDropdown } from './MinimalAvatarDropdown';

export function Header() {
  const { isAuthenticated } = useAuth();
  const { chatStarted } = useStore(aiState);
  const theme = useStore(themeStore);
  const logoSrc = useMemo(() => (theme === 'dark' ? '/logo-dark.png' : '/logo.png'), [theme]);

  return (
    <>
      <header
        className={classNames(
          'flex items-center justify-between px-3 py-2 gap-3 shrink-0 border-b h-[var(--header-height)]',
          {
            'border-transparent': !chatStarted,
            'border-upage-elements-borderColor': chatStarted,
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
          {chatStarted && <ClientOnly>{() => <ChatDescription />}</ClientOnly>}
        </div>

        <div className="flex items-center gap-2 justify-end">
          {chatStarted && (
            <>
              <ClientOnly>
                {() => (
                  <div className="mr-1">
                    <HeaderActionButtons />
                  </div>
                )}
              </ClientOnly>
            </>
          )}
          <MinimalAvatarDropdown />
        </div>
      </header>
    </>
  );
}
