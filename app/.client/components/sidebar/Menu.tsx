import { useStore } from '@nanostores/react';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import classNames from 'classnames';
import { motion, type Variants } from 'framer-motion';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ControlPanel } from '~/.client/components/@settings/core/ControlPanel';
import { Dialog, DialogButton, DialogDescription, DialogRoot, DialogTitle } from '~/.client/components/ui/Dialog';
import { SettingsButton } from '~/.client/components/ui/SettingsButton';
import { useAuth } from '~/.client/hooks';
import { type ServerChatItem, useChatEntries } from '~/.client/hooks/useChatEntries';
import { useChatOperate } from '~/.client/hooks/useChatOperate';
import { aiState } from '~/.client/stores/ai-state';
import { sidebarStore } from '~/.client/stores/sidebar';
import { cubicEasingFn } from '~/.client/utils/easings';
import WithTooltip from '../ui/Tooltip';
import { binDates } from './date-binning';
import { HistoryItem } from './HistoryItem.client';

const menuVariants = {
  closed: {
    opacity: 0,
    visibility: 'hidden',
    left: '-340px',
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
  open: {
    opacity: 1,
    visibility: 'initial',
    left: 0,
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
} satisfies Variants;

type DialogContent = { type: 'delete'; item: ServerChatItem } | { type: 'bulkDelete'; items: ServerChatItem[] } | null;

export const Menu = memo(({ className }: { className?: string }) => {
  const { duplicateCurrentChat, deleteChat, deleteSelectedItems } = useChatOperate();
  const { entries, isLoading, loadChatEntries } = useChatEntries();
  const { chatId } = useStore(aiState);
  const menuRef = useRef<HTMLDivElement>(null);
  const [dialogContent, setDialogContent] = useState<DialogContent>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const sidebar = useStore(sidebarStore);
  const [searchTerm, setSearchTerm] = useState('');

  const { isAuthenticated } = useAuth();
  const isShowMenu = useMemo(() => {
    return isAuthenticated && sidebar;
  }, [isAuthenticated, sidebar]);

  // 处理搜索
  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setSearchTerm(value);
      // 重新加载
      loadChatEntries(value);
    },
    [loadChatEntries],
  );

  // 初始加载聊天列表，仅在组件挂载时执行一次
  useEffect(() => {
    if (isShowMenu && !isInitialized) {
      loadChatEntries();
      setIsInitialized(true);
    }
  }, [isShowMenu, loadChatEntries, isInitialized]);

  const deleteItem = useCallback(
    async (event: React.UIEvent, item: ServerChatItem) => {
      event.preventDefault();
      event.stopPropagation();

      console.log('Attempting to delete chat:', { id: item.id, description: item.description });

      try {
        await deleteChat(item.id);
        toast.success('聊天已删除成功');
        if (chatId === item.id) {
          console.log('Navigating away from deleted chat');
          window.location.pathname = '/';
        }
      } catch (error) {
        console.error('Failed to delete chat:', error);
        toast.error('删除聊天失败');
      } finally {
        loadChatEntries();
      }
    },
    [loadChatEntries, deleteChat, chatId],
  );

  const closeDialog = () => {
    setDialogContent(null);
  };

  const toggleItemSelection = useCallback((id: string) => {
    setSelectedItems((prev) => {
      const newSelectedItems = prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id];
      console.log('Selected items updated:', newSelectedItems);

      return newSelectedItems;
    });
  }, []);

  const handleBulkDeleteClick = useCallback(() => {
    if (selectedItems.length === 0) {
      toast.info('至少选择一个聊天来删除');
      return;
    }

    const selectedChats = entries.filter((item) => selectedItems.includes(item.id));

    if (selectedChats.length === 0) {
      toast.error('未找到选中的聊天');
      return;
    }

    setDialogContent({ type: 'bulkDelete', items: selectedChats });
  }, [selectedItems, entries]);

  const selectAll = useCallback(() => {
    const allFilteredIds = entries.map((item) => item.id);
    setSelectedItems((prev) => {
      const allFilteredAreSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => prev.includes(id));

      if (allFilteredAreSelected) {
        // Deselect only the filtered items
        const newSelectedItems = prev.filter((id) => !allFilteredIds.includes(id));
        console.log('Deselecting all filtered items. New selection:', newSelectedItems);

        return newSelectedItems;
      }
      // Select all filtered items, adding them to any existing selections
      const newSelectedItems = [...new Set([...prev, ...allFilteredIds])];
      console.log('Selecting all filtered items. New selection:', newSelectedItems);

      return newSelectedItems;
    });
  }, [entries]);

  const handleDuplicate = async (id: string) => {
    await duplicateCurrentChat(id);
    loadChatEntries();
  };

  const handleSettingsClick = () => {
    setIsSettingsOpen(true);
  };

  const handleSettingsClose = () => {
    setIsSettingsOpen(false);
  };

  const setDialogContentWithLogging = useCallback((content: DialogContent) => {
    console.log('Setting dialog content:', content);
    setDialogContent(content);
  }, []);

  const handleDeleteSelectedItems = useCallback(
    async (itemsToDeleteNow: string[]) => {
      try {
        await deleteSelectedItems(itemsToDeleteNow);
        // 清空选择项
        setSelectedItems([]);

        // 检查是否需要导航
        const currentChatId = chatId;
        if (currentChatId && itemsToDeleteNow.includes(currentChatId)) {
          console.log('Navigating away from deleted chat');
          window.location.pathname = '/';
        }

        toast.success(`${itemsToDeleteNow.length} 个聊天已删除成功`);
      } catch (error) {
        console.error('Failed to delete chats:', error);
        toast.error('删除聊天失败');
      } finally {
        loadChatEntries();
      }
    },
    [deleteSelectedItems, loadChatEntries, chatId],
  );

  return (
    <TooltipProvider>
      <motion.div
        ref={menuRef}
        initial="closed"
        animate={isShowMenu ? 'open' : 'closed'}
        variants={menuVariants}
        style={{ width: '300px' }}
        className={classNames(
          'flex selection-accent flex-col side-menu absolute',
          'bg-upage-elements-background-depth-1 border-r rounded border-gray-100 dark:border-gray-800/50',
          'shadow-sm text-sm',
          className,
          isSettingsOpen ? 'z-40' : 'z-sidebar',
        )}
      >
        <div className="flex-1 flex flex-col size-full overflow-hidden">
          <div className="p-4 space-y-3">
            <a
              href="/"
              className="flex gap-2 items-center bg-purple-50 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-500/20 rounded-lg px-4 py-2.5 transition-colors"
            >
              <span className="inline-block i-ph:plus-circle size-4" />
              <span className="text-sm font-medium">开始新的聊天</span>
            </a>
            <div className="relative w-full">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 z-1">
                <div
                  className={`i-mingcute:search-2-line size-4 ${isLoading ? 'animate-pulse text-purple-500' : 'text-gray-400 dark:text-gray-500'}`}
                />
              </div>
              <input
                className="w-full bg-gray-50 dark:bg-gray-900 relative pl-9 pr-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-500/50 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-500 border border-gray-200 dark:border-gray-800"
                type="search"
                placeholder="搜索聊天记录..."
                value={searchTerm}
                onChange={handleSearch}
                aria-label="搜索聊天记录"
              />
            </div>
          </div>
          <div className="flex-1 overflow-auto px-2 pb-20">
            {isLoading && entries.length === 0 ? (
              <div className="px-4 text-gray-500 dark:text-gray-400 text-sm">加载中...</div>
            ) : (
              entries.length === 0 && (
                <div className="px-4 text-gray-500 dark:text-gray-400 text-sm">没有匹配的聊天记录</div>
              )
            )}
            <DialogRoot open={dialogContent !== null}>
              {binDates(entries).map(({ category, items }) => (
                <div key={category} className="mt-2 first:mt-0 space-y-1">
                  <div className="text-xs font-medium text-gray-500 dark:text-gray-400 sticky top-0 z-1 bg-upage-elements-background-depth-1 px-3 py-1">
                    {category}
                  </div>
                  <div className="space-y-0.5 pr-1">
                    {items.map((item) => (
                      <HistoryItem
                        key={item.id}
                        item={item}
                        onDelete={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          setDialogContentWithLogging({ type: 'delete', item });
                        }}
                        onDuplicate={() => handleDuplicate(item.id)}
                        selectionMode={selectedItems.length > 0}
                        isSelected={selectedItems.includes(item.id)}
                        onToggleSelection={toggleItemSelection}
                      />
                    ))}
                  </div>
                </div>
              ))}
              <Dialog onBackdrop={closeDialog} onClose={closeDialog}>
                {dialogContent?.type === 'delete' && (
                  <>
                    <div className="p-6 bg-white dark:bg-gray-950">
                      <DialogTitle className="text-gray-900 dark:text-white">删除聊天记录</DialogTitle>
                      <DialogDescription className="mt-2 text-gray-600 dark:text-gray-400">
                        你确定要删除{' '}
                        <span className="font-medium text-gray-900 dark:text-white">
                          {dialogContent.item.description}
                        </span>{' '}
                        聊天记录吗？
                      </DialogDescription>
                    </div>
                    <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
                      <DialogButton type="secondary" onClick={closeDialog}>
                        取消
                      </DialogButton>
                      <DialogButton
                        type="danger"
                        onClick={(event) => {
                          deleteItem(event, dialogContent.item);
                          closeDialog();
                        }}
                      >
                        删除
                      </DialogButton>
                    </div>
                  </>
                )}
                {dialogContent?.type === 'bulkDelete' && (
                  <>
                    <div className="p-6 bg-white dark:bg-gray-950">
                      <DialogTitle className="text-gray-900 dark:text-white">删除选中的聊天</DialogTitle>
                      <DialogDescription className="mt-2 text-gray-600 dark:text-gray-400">
                        你确定要删除 {dialogContent.items.length} 聊天：
                        <div className="mt-2 max-h-32 overflow-auto border border-gray-100 dark:border-gray-800 rounded-md bg-gray-50 dark:bg-gray-900 p-2">
                          <ul className="list-disc pl-5 space-y-1">
                            {dialogContent.items.map((item) => (
                              <li key={item.id} className="text-sm">
                                <span className="font-medium text-gray-900 dark:text-white">{item.description}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <span className="mt-3 block">你确定要删除这些聊天记录吗？</span>
                      </DialogDescription>
                    </div>
                    <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
                      <DialogButton type="secondary" onClick={closeDialog}>
                        取消
                      </DialogButton>
                      <DialogButton
                        type="danger"
                        onClick={() => {
                          /*
                           * Pass the current selectedItems to the delete function.
                           * This captures the state at the moment the user confirms.
                           */
                          const itemsToDeleteNow = [...selectedItems];
                          handleDeleteSelectedItems(itemsToDeleteNow);
                          closeDialog();
                        }}
                      >
                        删除
                      </DialogButton>
                    </div>
                  </>
                )}
              </Dialog>
            </DialogRoot>
          </div>
          {selectedItems.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="absolute bottom-20 z-1 w-full flex justify-center"
            >
              <div className="rounded-full bg-upage-elements-background-depth-1 flex items-center justify-center border border-gray-200 dark:border-gray-800 shadow-md dark:shadow-gray-950/50 p-2.5 gap-3 transition-all duration-200">
                <WithTooltip tooltip={selectedItems.length === entries.length ? '取消全选' : '全选'}>
                  <button
                    onClick={selectAll}
                    className="rounded-full bg-gray-50 dark:bg-gray-800 p-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center transition-colors duration-200"
                  >
                    {selectedItems.length === entries.length ? (
                      <div className="i-mingcute:checkbox-fill size-5 text-blue-500" />
                    ) : (
                      <div className="i-mingcute:checkbox-line size-5 text-blue-500" />
                    )}
                  </button>
                </WithTooltip>
                <WithTooltip tooltip="删除选中项">
                  <button
                    onClick={handleBulkDeleteClick}
                    className="rounded-full bg-gray-50 dark:bg-gray-800 p-2.5 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center transition-colors duration-200"
                  >
                    <div className="i-mingcute:delete-2-line size-5 text-red-500" />
                  </button>
                </WithTooltip>
              </div>
            </motion.div>
          )}
          {import.meta.env.MODE === 'development' && (
            <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-800 px-4 py-3">
              <SettingsButton onClick={handleSettingsClick} />
            </div>
          )}
        </div>
      </motion.div>

      {import.meta.env.MODE === 'development' && <ControlPanel open={isSettingsOpen} onClose={handleSettingsClose} />}
    </TooltipProvider>
  );
});
