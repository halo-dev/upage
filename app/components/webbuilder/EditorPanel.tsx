import * as Tabs from '@radix-ui/react-tabs';
import { memo } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { ErrorBoundary } from '~/components/ErrorBoundary';
import type { PageMap } from '~/lib/stores/pages';
import type { PageHistory, Section } from '~/types/actions';
import type { DocumentProperties } from '~/types/editor';
import { logger, renderLogger } from '~/utils/logger';
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
}

const editorSettings: any = { tabSize: 2 };

export const EditorPanel = memo(
  ({
    documents,
    pages,
    unsavedPages,
    currentPage,
    currentSection,
    isStreaming,
    onEditorChange,
    onPageSave,
    onPageSelect,
    onPageReset,
    onLoad,
    onReady,
  }: EditorPanelProps) => {
    renderLogger.trace('EditorPanel');
    return (
      <PanelGroup direction="vertical">
        <Panel defaultSize={100} minSize={20}>
          <PanelGroup direction="horizontal">
            <Panel defaultSize={20} minSize={15} collapsible className="border-r border-upage-elements-borderColor">
              <div className="h-full">
                <Tabs.Root defaultValue="pages" className="flex flex-col h-full">
                  <Tabs.Content value="pages" className="flex-grow overflow-auto focus-visible:outline-none">
                    <PageTree
                      className="h-full"
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
            <Panel className="flex flex-col" defaultSize={80} minSize={20}>
              <div className="h-full flex-1 overflow-hidden">
                <ErrorBoundary
                  onError={(error) => {
                    logger.error('Editor 组件发生错误', { error });
                  }}
                >
                  <EditorStudio
                    documents={documents}
                    editable={!isStreaming && currentPage !== undefined}
                    settings={editorSettings}
                    currentPage={currentPage}
                    currentSection={currentSection}
                    onChange={onEditorChange}
                    onSave={onPageSave}
                    onReset={onPageReset}
                    onLoad={onLoad}
                    onReady={onReady}
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
