import { Popover, Transition } from '@headlessui/react';
import { useStore } from '@nanostores/react';
import classNames from 'classnames';
import { type Change, diffLines } from 'diff';
import { memo, useCallback, useMemo, useState } from 'react';
import { webBuilderStore } from '~/.client/stores/web-builder';

interface PageModifiedDropdownProps {
  onSelectPage: (pageName: string) => void;
}

export const PageModifiedDropdown = memo(({ onSelectPage }: PageModifiedDropdownProps) => {
  const pageHistory = useStore(webBuilderStore.pagesStore.pageHistory);
  const currentSelectedPage = useStore(webBuilderStore.editorStore.selectedDocument);
  const modifiedPages = Object.entries(pageHistory);
  const hasChanges = modifiedPages.length > 0;
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPages = useMemo(() => {
    return modifiedPages.filter(([pageName]) => pageName.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [modifiedPages, searchQuery]);

  const handleSelectPage = useCallback(
    (pageName: string, close: () => void) => {
      // 如果是当前已选中的页面，不执行任何操作
      if (pageName === currentSelectedPage) {
        return;
      }
      onSelectPage(pageName);
      webBuilderStore.currentView.set('diff');
      // 关闭下拉菜单
      close();
    },
    [onSelectPage, currentSelectedPage],
  );

  return (
    <div className="flex items-center gap-2">
      <Popover className="relative">
        {({ open, close }: { open: boolean; close: () => void }) => (
          <>
            <Popover.Button className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-upage-elements-background-depth-2 hover:bg-upage-elements-background-depth-3 transition-colors text-upage-elements-textPrimary border border-upage-elements-borderColor">
              <span className="font-medium">更改页面</span>
              {hasChanges && (
                <span className="size-5 rounded-full bg-accent-500/20 text-accent-500 text-xs flex items-center justify-center border border-accent-500/30">
                  {modifiedPages.length}
                </span>
              )}
            </Popover.Button>
            <Transition
              show={open}
              enter="transition duration-100 ease-out"
              enterFrom="transform scale-95 opacity-0"
              enterTo="transform scale-100 opacity-100"
              leave="transition duration-75 ease-out"
              leaveFrom="transform scale-100 opacity-100"
              leaveTo="transform scale-95 opacity-0"
            >
              <Popover.Panel className="absolute right-0 z-20 mt-2 w-80 origin-top-right rounded-xl bg-upage-elements-background-depth-2 shadow-xl border border-upage-elements-borderColor">
                <div className="p-2">
                  <div className="relative mx-2 mb-2">
                    <input
                      type="text"
                      placeholder="搜索页面..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg bg-upage-elements-background-depth-1 border border-upage-elements-borderColor focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                    <div className="absolute left-2 top-1/2 -translate-y-1/2 text-upage-elements-textTertiary">
                      <div className="i-ph:magnifying-glass" />
                    </div>
                  </div>

                  <div className="max-h-60 overflow-y-auto">
                    {filteredPages.length > 0 ? (
                      filteredPages.map(([pageName, history]) => {
                        const isActive = pageName === currentSelectedPage;

                        return (
                          <button
                            key={pageName}
                            onClick={() => handleSelectPage(pageName, close)}
                            disabled={isActive}
                            className={classNames('w-full px-3 py-2 text-left rounded-md transition-colors group', {
                              'bg-blue-500/10 cursor-default': isActive,
                              'hover:bg-upage-elements-background-depth-1 hover:bg-blue-500/10 bg-transparent cursor-pointer':
                                !isActive,
                            })}
                          >
                            <div className="flex items-center gap-2">
                              <div className="shrink-0 size-5 text-upage-elements-textTertiary">
                                <div
                                  className={classNames({
                                    'i-ph:file-text-duotone text-blue-500': isActive,
                                    'i-ph:file-text': !isActive,
                                  })}
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex flex-col min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={classNames('truncate text-sm font-medium', {
                                          'text-blue-600': isActive,
                                          'text-upage-elements-textPrimary': !isActive,
                                        })}
                                      >
                                        {pageName.split('/').pop()}
                                      </span>
                                      {isActive && (
                                        <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-600 font-medium">
                                          当前
                                        </span>
                                      )}
                                    </div>
                                    <span className="truncate text-xs text-upage-elements-textTertiary">
                                      {pageName}
                                    </span>
                                  </div>
                                  {(() => {
                                    // 计算差异统计
                                    const { additions, deletions } = (() => {
                                      if (!history.originalContent) {
                                        return { additions: 0, deletions: 0 };
                                      }

                                      const normalizedOriginal = history.originalContent.replace(/\r\n/g, '\n');
                                      const normalizedCurrent =
                                        history.versions[history.versions.length - 1]?.content.replace(/\r\n/g, '\n') ||
                                        '';

                                      if (normalizedOriginal === normalizedCurrent) {
                                        return { additions: 0, deletions: 0 };
                                      }

                                      const changes = diffLines(normalizedOriginal, normalizedCurrent, {
                                        newlineIsToken: false,
                                        ignoreWhitespace: true,
                                      });

                                      return changes.reduce(
                                        (acc: { additions: number; deletions: number }, change: Change) => {
                                          if (change.added) {
                                            acc.additions += change.value.split('\n').length;
                                          }

                                          if (change.removed) {
                                            acc.deletions += change.value.split('\n').length;
                                          }

                                          return acc;
                                        },
                                        { additions: 0, deletions: 0 },
                                      );
                                    })();

                                    const showStats = additions > 0 || deletions > 0;

                                    return (
                                      showStats && (
                                        <div className="flex items-center gap-1 text-xs shrink-0">
                                          {additions > 0 && <span className="text-green-500">+{additions}</span>}
                                          {deletions > 0 && <span className="text-red-500">-{deletions}</span>}
                                        </div>
                                      )
                                    );
                                  })()}
                                </div>
                              </div>
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <div className="flex flex-col items-center justify-center p-4 text-center">
                        <div className="size-12 mb-2 text-upage-elements-textTertiary">
                          <div className="i-ph:file-dashed" />
                        </div>
                        <p className="text-sm font-medium text-upage-elements-textPrimary">
                          {searchQuery ? '没有匹配的页面' : '没有修改的页面'}
                        </p>
                        <p className="text-xs text-upage-elements-textTertiary mt-1">
                          {searchQuery ? '尝试其他搜索' : '更改将在此处显示'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </Popover.Panel>
            </Transition>
          </>
        )}
      </Popover>
    </div>
  );
});

PageModifiedDropdown.displayName = 'PageModifiedDropdown';
