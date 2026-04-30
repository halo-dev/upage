import * as Tabs from '@radix-ui/react-tabs';
import { memo } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { ErrorBoundary } from '~/.client/components/ErrorBoundary';
import type { EditorPatch } from '~/.client/stores/pages';
import { logger, renderLogger } from '~/.client/utils/logger';
import type { PageHistory, Section } from '~/types/actions';
import type { DocumentProperties } from '~/types/editor';
import type { PageMap } from '~/types/pages';
import {
  EditorStudio,
  type OnChangeCallback,
  type OnLoadCallback,
  type OnReadyCallback,
  type OnSaveCallback,
} from '../editor/Editor';
import PageTree from './PageTree';

interface EditorPanelProps {
  documents?: Record<string, DocumentProperties>;
  currentPage?: string;
  currentSection?: Section;
  currentPatch?: EditorPatch;
  pages?: PageMap;
  unsavedPages?: Set<string>;
  pageHistory?: Record<string, PageHistory>;
  isStreaming?: boolean;
  onEditorChange?: OnChangeCallback;
  onPageSave?: OnSaveCallback;
  onPageSelect?: (pageName: string) => void;
  onPageReset?: () => void;
  onLoad?: OnLoadCallback;
  onReady?: OnReadyCallback;
  onPatchApplied?: (patchId: string) => void;
}

const editorSettings: any = { tabSize: 2 };

export const EditorPanel = memo(
  ({
    documents,
    pages,
    unsavedPages,
    currentPage,
    currentSection,
    currentPatch,
    isStreaming,
    onEditorChange,
    onPageSave,
    onPageSelect,
    onPageReset,
    onLoad,
    onReady,
    onPatchApplied,
  }: EditorPanelProps) => {
    renderLogger.trace('EditorPanel');
    return (
      <PanelGroup direction="vertical" className="h-full min-h-0">
        <Panel defaultSize={100} minSize={20} className="min-h-0">
          <PanelGroup direction="horizontal" className="h-full min-h-0">
            <Panel
              defaultSize={20}
              minSize={15}
              collapsible
              className="min-h-0 border-r border-upage-elements-borderColor"
            >
              <div className="h-full min-h-0">
                <Tabs.Root defaultValue="pages" className="flex h-full min-h-0 flex-col">
                  <Tabs.Content value="pages" className="min-h-0 flex-grow overflow-auto focus-visible:outline-none">
                    <PageTree
                      className="h-full min-h-0"
                      pages={pages}
                      unsavedPages={unsavedPages}
                      selectedPage={currentPage}
                      onPageSelect={onPageSelect}
                    />
                  </Tabs.Content>
                </Tabs.Root>
              </div>
            </Panel>

            <PanelResizeHandle />
            <Panel className="flex min-h-0 flex-col" defaultSize={80} minSize={20}>
              <div className="h-full min-h-0 flex-1 overflow-hidden">
                <ErrorBoundary
                  onError={(error) => {
                    const errorMessage = error instanceof Error ? error.message : '未知错误';
                    logger.error(`Editor 组件发生错误: ${errorMessage}`);
                  }}
                >
                  <EditorStudio
                    documents={documents}
                    editable={!isStreaming && currentPage !== undefined}
                    settings={editorSettings}
                    currentPage={currentPage}
                    currentSection={currentSection}
                    currentPatch={currentPatch}
                    onChange={onEditorChange}
                    onSave={onPageSave}
                    onReset={onPageReset}
                    onLoad={onLoad}
                    onReady={onReady}
                    onPatchApplied={onPatchApplied}
                  />
                </ErrorBoundary>
              </div>
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>
    );
  },
);
