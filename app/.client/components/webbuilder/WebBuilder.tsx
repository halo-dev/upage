import { useStore } from '@nanostores/react';
import classNames from 'classnames';
import { type HTMLMotionProps, motion, type Variants } from 'framer-motion';
import { memo, useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type {
  OnChangeCallback,
  OnLoadCallback,
  OnReadyCallback,
  OnSaveCallback,
} from '~/.client/components/editor/Editor';
import { PushToGitHubDialog } from '~/.client/components/header/PushToGitHubDialog';
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
import { PageModifiedDropdown } from './PageModifiedDropdown';
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
  const chatHistory = useChatHistory();

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

  const onPageSave = useCallback<OnSaveCallback>(() => {
    if (isStreaming) {
      return;
    }
    doPageSave();
  }, [isStreaming]);

  const doPageSave = useCallback(() => {
    webBuilderStore.saveAllPages('user').catch(() => {
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
    const projectData = await chatHistory?.getLoadProject?.();
    // 新版本数据
    if (projectData?.pages) {
      // html 为 pages 中 index 的 content
      return projectData.pages;
    }
    return [];
  }, [chatHistory]);

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
                    onPageSave={onPageSave}
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
        <PushToGitHubDialog isOpen={isPushDialogOpen} onClose={() => setIsPushDialogOpen(false)} />
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
