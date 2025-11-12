import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import classNames from 'classnames';
import { motion } from 'framer-motion';
import { useMemo, useState } from 'react';
import { ChatUsageDialog } from '~/.client/components/chat/usage/ChatUsageDialog';
import { DeploymentRecordsDialog } from '~/.client/components/chat/usage/DeploymentRecordsDialog';
import { Button } from '~/.client/components/ui/Button';
import { ConfirmationDialog } from '~/.client/components/ui/Dialog';
import { useAuth } from '~/.client/hooks/useAuth';
import { useChatUsage } from '~/.client/hooks/useChatUsage';

interface MinimalAvatarDropdownProps {}

export const MinimalAvatarDropdown = ({}: MinimalAvatarDropdownProps) => {
  const { userInfo, isAuthenticated, signOut, signIn } = useAuth();

  const { usageStats } = useChatUsage();

  if (!isAuthenticated) {
    return (
      <Button variant="secondary" onClick={() => signIn()}>
        登录 / 注册
      </Button>
    );
  }

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

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showUsageDialog, setShowUsageDialog] = useState(false);
  const [showDeploymentRecordsDialog, setShowDeploymentRecordsDialog] = useState(false);

  return (
    <>
      <ChatUsageDialog isOpen={showUsageDialog} onClose={() => setShowUsageDialog(false)} />
      <DeploymentRecordsDialog
        isOpen={showDeploymentRecordsDialog}
        onClose={() => setShowDeploymentRecordsDialog(false)}
      />

      <ConfirmationDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        title="退出登录？"
        description="退出登录后，您需要重新登录才能继续使用。"
        confirmLabel="退出登录"
        cancelLabel="取消"
        variant="destructive"
        onConfirm={() => signOut()}
      />

      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <motion.button
            className="size-8 rounded-full text-upage-elements-item-contentDefault bg-transparent flex items-center justify-center focus:outline-none"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="size-full rounded-full object-cover select-none"
                loading="eager"
                decoding="sync"
              />
            ) : (
              <div className="size-full flex items-center justify-center">
                <div className="i-ph:user-circle-fill size-8" />
              </div>
            )}
          </motion.button>
        </DropdownMenu.Trigger>

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className={classNames(
              'min-w-[240px] z-[250]',
              'bg-white dark:bg-gray-950 border border-gray-200/50 dark:border-gray-800/50 rounded-lg shadow-lg',
              'animate-in fade-in-0 zoom-in-95',
              'p-1.5 space-y-1.5',
            )}
            sideOffset={5}
            align="end"
          >
            <div className={classNames('px-4 py-3 flex items-center gap-3')}>
              <div className="size-10 rounded-full overflow-hidden flex-shrink-0 bg-white dark:bg-gray-800 shadow-sm">
                {Boolean(avatarUrl) ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className={classNames('size-full', 'object-cover', 'transform-gpu', 'image-rendering-crisp')}
                    loading="eager"
                    decoding="sync"
                  />
                ) : (
                  <div className="size-full flex items-center justify-center text-gray-400 dark:text-gray-500 font-medium text-lg">
                    <div className="i-ph:user-circle-fill size-8" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{displayName}</div>
                {!!userInfo?.email && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{contactInfo}</div>
                )}
              </div>
            </div>

            <DropdownMenu.Separator className="h-1px bg-gray-100 dark:bg-gray-800" />

            <DropdownMenu.Item
              className={classNames(
                'flex items-center gap-2 px-4 py-2.5',
                'text-sm text-gray-700 dark:text-gray-200',
                'hover:bg-purple-50 dark:hover:bg-purple-500/10',
                'hover:text-purple-500 dark:hover:text-purple-400',
                'cursor-pointer transition-all duration-200',
                'outline-none',
                'group',
                'rounded-md',
              )}
              onClick={() => setShowUsageDialog(true)}
            >
              <div className="i-ph:chart-line size-4 text-gray-400 group-hover:text-purple-500 dark:group-hover:text-purple-400 transition-colors" />
              <div className="flex-1">API 使用量</div>
              {usageStats && (
                <div className="text-xs px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300">
                  {usageStats.total._count}
                </div>
              )}
            </DropdownMenu.Item>

            <DropdownMenu.Item
              className={classNames(
                'flex items-center gap-2 px-4 py-2.5',
                'text-sm text-gray-700 dark:text-gray-200',
                'hover:bg-purple-50 dark:hover:bg-purple-500/10',
                'hover:text-purple-500 dark:hover:text-purple-400',
                'cursor-pointer transition-all duration-200',
                'outline-none',
                'group',
                'rounded-md',
              )}
              onClick={() => setShowDeploymentRecordsDialog(true)}
            >
              <div className="i-ph:globe size-4 text-gray-400 group-hover:text-purple-500 dark:group-hover:text-purple-400 transition-colors" />
              <div className="flex-1">部署记录</div>
            </DropdownMenu.Item>

            <DropdownMenu.Item
              className={classNames(
                'flex items-center gap-2 px-4 py-2.5',
                'text-sm text-gray-700 dark:text-gray-200',
                'hover:bg-purple-50 dark:hover:bg-purple-500/10',
                'hover:text-purple-500 dark:hover:text-purple-400',
                'cursor-pointer transition-all duration-200',
                'outline-none',
                'group',
                'rounded-md',
              )}
              onClick={() => setShowLogoutConfirm(true)}
            >
              <div className="i-ph:sign-out size-4 text-gray-400 group-hover:text-purple-500 dark:group-hover:text-purple-400 transition-colors" />
              退出登录
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </>
  );
};
