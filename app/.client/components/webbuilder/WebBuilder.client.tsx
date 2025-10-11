import { Popover, Transition } from '@headlessui/react';
import { useStore } from '@nanostores/react';
import classNames from 'classnames';
import { type Change, diffLines } from 'diff';
import { type HTMLMotionProps, motion, type Variants } from 'framer-motion';
import { memo, useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type {
  OnChangeCallback,
  OnLoadCallback,
  OnReadyCallback,
  OnSaveCallback,
} from '~/.client/components/editor/Editor';
import { PushToGitHubDialog } from '~/.client/components/header/connections/components/PushToGitHubDialog';
import { IconButton } from '~/.client/components/ui/IconButton';
import { PanelHeaderButton } from '~/.client/components/ui/PanelHeaderButton';
import { Slider, type SliderOptions } from '~/.client/components/ui/Slider';
import useViewport from '~/.client/hooks';
import { useProject } from '~/.client/hooks/useProject';
import { useChatHistory } from '~/.client/persistence';
import { aiState } from '~/.client/stores/ai-state';
import { type WebBuilderViewType, webBuilderStore } from '~/.client/stores/web-builder';
import { cubicEasingFn } from '~/.client/utils/easings';
import type { Page } from '~/types/actions';
import type { PageMap } from '~/types/pages';
import { renderLogger } from '~/utils/logger';
import { DiffView } from './DiffView';
import { EditorPanel } from './EditorPanel';
import { Preview } from './Preview';

const viewTransition = { ease: cubicEasingFn };

const sliderOptions: SliderOptions<WebBuilderViewType> = {
  left: {
    value: 'code',
    text: '可视化',
  },
  middle: {
    value: 'diff',
    text: '差异',
  },
  right: {
    value: 'preview',
    text: '预览',
  },
};

const workbenchVariants = {
  closed: {
    width: 0,
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
  open: {
    width: 'var(--workbench-width)',
    transition: {
      duration: 0.2,
      ease: cubicEasingFn,
    },
  },
} satisfies Variants;

const PageModifiedDropdown = memo(({ onSelectPage }: { onSelectPage: (pageName: string) => void }) => {
  const pageHistory = useStore(webBuilderStore.pagesStore.pageHistory);
  const modifiedPages = Object.entries(pageHistory);
  const hasChanges = modifiedPages.length > 0;
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPages = useMemo(() => {
    return modifiedPages.filter(([pageName]) => pageName.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [modifiedPages, searchQuery]);

  return (
    <div className="flex items-center gap-2">
      <Popover className="relative">
        {({ open }: { open: boolean }) => (
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
                        return (
                          <button
                            key={pageName}
                            onClick={() => onSelectPage(pageName)}
                            className="w-full px-3 py-2 text-left rounded-md hover:bg-upage-elements-background-depth-1 transition-colors group bg-transparent"
                          >
                            <div className="flex items-center gap-2">
                              <div className="shrink-0 size-5 text-upage-elements-textTertiary">
                                <div className="i-ph:file-text" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex flex-col min-w-0">
                                    <span className="truncate text-sm font-medium text-upage-elements-textPrimary">
                                      {pageName.split('/').pop()}
                                    </span>
                                    <span className="truncate text-xs text-upage-elements-textTertiary">
                                      {pageName}
                                    </span>
                                  </div>
                                  {(() => {
                                    // Calculate diff stats
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

export const WebBuilder = memo(() => {
  renderLogger.trace('webBuilder');

  const [isPushDialogOpen, setIsPushDialogOpen] = useState(false);

  // const hasPreview = useStore(computed(webBuilderStore.previews, (previews) => previews.length > 0));
  const showWorkbench = useStore(webBuilderStore.showWorkbench);
  const { showChat, chatStarted, isStreaming } = useStore(aiState);
  const documents = useStore(webBuilderStore.editorStore.editorDocuments);
  const currentPage = useStore(webBuilderStore.editorStore.selectedDocument);
  const currentSection = useStore(webBuilderStore.pagesStore.currentSection);
  const unsavedPages = useStore(webBuilderStore.editorStore.unsavedDocuments);
  const pages = useStore(webBuilderStore.pagesStore.pages);
  const selectedView = useStore(webBuilderStore.currentView);

  const isSmallViewport = useViewport(1024);
  const { saveProject } = useProject();
  const { getLoadProject } = useChatHistory();

  const setSelectedView = useCallback(
    (view: WebBuilderViewType) => {
      if (isStreaming && view !== 'code') {
        return;
      }
      webBuilderStore.currentView.set(view);
    },
    [isStreaming],
  );

  const exportable = useMemo(() => {
    return Object.keys(pages).length > 0;
  }, [pages]);

  const onEditorChange = useCallback<OnChangeCallback>((_, pageName, html) => {
    webBuilderStore.setDocumentContent(pageName, html);
  }, []);

  const onPageSelect = useCallback((pageName: string | undefined) => {
    webBuilderStore.setSelectedPage(pageName);
  }, []);

  const onAutoPageSave = useCallback<OnSaveCallback>(() => {
    if (isStreaming) {
      return;
    }
    doPageSave();
  }, [isStreaming]);

  const doPageSave = useCallback(() => {
    webBuilderStore.saveAllPages().catch(() => {
      toast.error('文件内容更新失败');
    });
    const currentMessageId = webBuilderStore.chatStore.currentMessageId.get();
    if (currentMessageId) {
      saveProject(currentMessageId);
    }
  }, [saveProject]);

  const onPageReset = useCallback(() => {
    webBuilderStore.resetCurrentPage();
  }, []);

  const onLoad = useCallback<OnLoadCallback>(async () => {
    const pages = await handleLoadProject();
    const pageMap = Object.fromEntries(pages.map((page) => [page.name, page])) as PageMap;
    webBuilderStore.setPages(pageMap);
  }, []);

  const onReady = useCallback<OnReadyCallback>((editor) => {
    webBuilderStore.editorStore.setEditorInstance(editor);
  }, []);

  const handleSelectPage = useCallback((pageName: string) => {
    webBuilderStore.setSelectedPage(pageName);
    webBuilderStore.currentView.set('diff');
  }, []);

  // 处理保存的数据，将其转为编辑器可直接使用的格式
  const handleLoadProject = useCallback(async (): Promise<Page[]> => {
    const projectData = await getLoadProject();
    // 新版本数据
    if (projectData?.pages) {
      // html 为 pages 中 index 的 content
      return projectData.pages;
    }
    return [];
  }, [getLoadProject]);

  return (
    chatStarted && (
      <motion.div
        initial="closed"
        animate={showWorkbench ? 'open' : 'closed'}
        variants={workbenchVariants}
        className="z-workbench"
      >
        <div
          className={classNames(
            'fixed top-[calc(var(--header-height)+1.5rem)] bottom-6 w-[var(--workbench-inner-width)] mr-4 z-0 transition-[transform,width] duration-200 upage-ease-cubic-bezier',
            {
              'w-full': isSmallViewport,
              'left-0': !showChat,
              'transform-none': showWorkbench && isSmallViewport,
              'translate-x-0': showWorkbench && !isSmallViewport,
              'translate-x-full': !showWorkbench,
            },
          )}
        >
          <div className="absolute inset-0 px-2 lg:px-6">
            <div className="h-full flex flex-col bg-upage-elements-background-depth-2 border border-upage-elements-borderColor shadow-sm rounded-lg overflow-hidden">
              <div className="flex items-center px-3 py-2 border-b border-upage-elements-borderColor">
                <Slider
                  selected={selectedView}
                  options={sliderOptions}
                  setSelected={setSelectedView}
                  disabled={isStreaming}
                />
                <div className="ml-auto" />
                {selectedView === 'code' && (
                  <div className="flex overflow-y-auto">
                    {unsavedPages.size > 0 && (
                      <PanelHeaderButton className="mr-1 text-sm" onClick={doPageSave}>
                        <div className="i-mingcute:save-line" />
                        保存
                      </PanelHeaderButton>
                    )}
                    <PanelHeaderButton
                      className="mr-1 text-sm"
                      disabled={!exportable}
                      onClick={() => {
                        webBuilderStore.exportToZip();
                      }}
                    >
                      <div className="i-mingcute:download-2-line" />
                      下载代码
                    </PanelHeaderButton>
                    <PanelHeaderButton
                      className="mr-1 text-sm"
                      disabled={!exportable}
                      onClick={() => setIsPushDialogOpen(true)}
                    >
                      <div className="i-ph:git-branch" />
                      推送到 GitHub
                    </PanelHeaderButton>
                  </div>
                )}
                {selectedView === 'diff' && <PageModifiedDropdown onSelectPage={handleSelectPage} />}
                <IconButton
                  icon="i-mingcute:close-circle-line"
                  className="-mr-1"
                  size="xl"
                  onClick={() => {
                    webBuilderStore.showWorkbench.set(false);
                  }}
                />
              </div>
              <div className="relative flex-1 overflow-hidden">
                <View initial={{ x: '0%' }} animate={{ x: selectedView === 'code' ? '0%' : '-100%' }}>
                  <EditorPanel
                    documents={documents}
                    currentPage={currentPage}
                    currentSection={currentSection}
                    isStreaming={isStreaming}
                    pages={pages}
                    unsavedPages={unsavedPages}
                    onPageSelect={onPageSelect}
                    onEditorChange={onEditorChange}
                    onPageSave={onAutoPageSave}
                    onPageReset={onPageReset}
                    onLoad={onLoad}
                    onReady={onReady}
                  />
                </View>
                <View
                  initial={{ x: '100%' }}
                  animate={{ x: selectedView === 'diff' ? '0%' : selectedView === 'code' ? '100%' : '-100%' }}
                >
                  {selectedView === 'diff' && !isStreaming ? <DiffView /> : <div></div>}
                </View>
                <View initial={{ x: '100%' }} animate={{ x: selectedView === 'preview' ? '0%' : '100%' }}>
                  {selectedView === 'preview' ? <Preview /> : <div></div>}
                </View>
              </div>
            </div>
          </div>
        </div>
        <PushToGitHubDialog
          isOpen={isPushDialogOpen}
          onClose={() => setIsPushDialogOpen(false)}
          onPush={async (repoName, username, token) => {
            try {
              const commitMessage = prompt('请输入提交信息:', 'Initial commit') || 'Initial commit';
              await webBuilderStore.pushToGitHub(repoName, commitMessage, username, token);

              const repoUrl = `https://github.com/${username}/${repoName}`;
              return repoUrl;
            } catch (error) {
              console.error('Error pushing to GitHub:', error);
              toast.error('GitHub 推送失败');
              throw error;
            }
          }}
        />
      </motion.div>
    )
  );
});

// View component for rendering content with motion transitions
interface ViewProps extends HTMLMotionProps<'div'> {
  children: React.JSX.Element;
}

const View = memo(({ children, ...props }: ViewProps) => {
  return (
    <motion.div className="absolute inset-0" transition={viewTransition} {...props}>
      {children}
    </motion.div>
  );
});
