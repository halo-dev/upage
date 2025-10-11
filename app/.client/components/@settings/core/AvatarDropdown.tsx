import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import classNames from 'classnames';
import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { useAuth } from '~/.client/hooks/useAuth';
import type { TabType } from './types';

interface AvatarDropdownProps {
  onSelectTab: (tab: TabType) => void;
}

export const AvatarDropdown = ({ onSelectTab }: AvatarDropdownProps) => {
  const { userInfo, isAuthenticated } = useAuth();

  const displayName = useMemo(() => {
    if (!isAuthenticated || !userInfo) {
      return 'Guest User';
    }

    return userInfo.name || userInfo.username;
  }, [userInfo]);

  const contactInfo = useMemo(() => {
    if (!isAuthenticated || !userInfo) {
      return null;
    }

    if (userInfo.phone_number) {
      return `+${userInfo.phone_number}`;
    }

    return userInfo.email;
  }, [userInfo]);

  const avatarUrl = isAuthenticated && userInfo?.picture ? userInfo.picture : '';

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <motion.button
          className="size-10 rounded-full bg-transparent flex items-center justify-center focus:outline-none"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="size-full rounded-full object-cover"
              loading="eager"
              decoding="sync"
            />
          ) : (
            <div className="size-full rounded-full flex items-center justify-center bg-white dark:bg-gray-800 text-gray-400 dark:text-gray-500">
              <div className="i-ph:question size-6" />
            </div>
          )}
        </motion.button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={classNames(
            'min-w-[240px] z-[250]',
            'bg-white dark:bg-[#141414]',
            'rounded-lg shadow-lg',
            'border border-gray-200/50 dark:border-gray-800/50',
            'animate-in fade-in-0 zoom-in-95',
            'py-1',
          )}
          sideOffset={5}
          align="end"
        >
          <div
            className={classNames(
              'px-4 py-3 flex items-center gap-3',
              'border-b border-gray-200/50 dark:border-gray-800/50',
            )}
          >
            <div className="size-10 rounded-full overflow-hidden flex-shrink-0 bg-white dark:bg-gray-800 shadow-sm">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className={classNames('size-full', 'object-cover', 'transform-gpu', 'image-rendering-crisp')}
                  loading="eager"
                  decoding="sync"
                />
              ) : (
                <div className="size-full flex items-center justify-center text-gray-400 dark:text-gray-500 font-medium text-lg">
                  <span className="relative -top-0.5">?</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{displayName}</div>
              {isAuthenticated && userInfo?.email && (
                <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{contactInfo}</div>
              )}
            </div>
          </div>

          <DropdownMenu.Item
            className={classNames(
              'flex items-center gap-2 px-4 py-2.5',
              'text-sm text-gray-700 dark:text-gray-200',
              'hover:bg-purple-50 dark:hover:bg-purple-500/10',
              'hover:text-purple-500 dark:hover:text-purple-400',
              'cursor-pointer transition-all duration-200',
              'outline-none',
              'group',
            )}
            onClick={() => onSelectTab('settings')}
          >
            <div className="i-ph:gear-six size-4 text-gray-400 group-hover:text-purple-500 dark:group-hover:text-purple-400 transition-colors" />
            Settings
          </DropdownMenu.Item>

          <div className="my-1 border-t border-gray-200/50 dark:border-gray-800/50" />

          <DropdownMenu.Item
            className={classNames(
              'flex items-center gap-2 px-4 py-2.5',
              'text-sm text-gray-700 dark:text-gray-200',
              'hover:bg-purple-50 dark:hover:bg-purple-500/10',
              'hover:text-purple-500 dark:hover:text-purple-400',
              'cursor-pointer transition-all duration-200',
              'outline-none',
              'group',
            )}
            onClick={() => onSelectTab('task-manager')}
          >
            <div className="i-ph:activity size-4 text-gray-400 group-hover:text-purple-500 dark:group-hover:text-purple-400 transition-colors" />
            Task Manager
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};
