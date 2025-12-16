import { atom, type WritableAtom } from 'nanostores';
import { toast } from 'sonner';
import { replaceUrlsWithRelativePaths } from '~/.client/utils/asset-path-converter';
import { createScopedLogger } from '~/.client/utils/logger';
import type { ChangeSource } from '~/types/actions';
import type { PageMap } from '~/types/pages';
import { ChatStore } from './chat';
import { EditorStore } from './editor';
import { PagesStore } from './pages';
import { PreviewsStore } from './previews';

const logger = createScopedLogger('WebBuilderStore');

export type WebBuilderViewType = 'code' | 'diff' | 'preview';

export type GetProjectFilesOptions = {
  inline?: boolean;
  pathMode?: 'relative' | 'absolute';
};

export type ExportEditorFile = {
  filename: string;
  content: string;
  mimeType: string;
};

/**
 * WebBuilderStore 是整个 builder 的 store，负责管理、统筹所有与构建器有关的状态。
 */
export class WebBuilderStore {
  readonly chatStore: ChatStore;
  readonly previewsStore: PreviewsStore;
  readonly pagesStore: PagesStore;
  readonly editorStore: EditorStore;

  // 是否显示 webBuilder
  showWorkbench: WritableAtom<boolean> = import.meta.hot?.data?.showWorkbench ?? atom(false);
  // 当前 webBuilder 所在的视图
  currentView: WritableAtom<WebBuilderViewType> = import.meta.hot?.data?.currentView ?? atom('code');

  constructor() {
    this.previewsStore = new PreviewsStore();
    this.pagesStore = new PagesStore();
    this.chatStore = new ChatStore(this, this.pagesStore);
    this.editorStore = new EditorStore(this.pagesStore);

    if (import.meta.hot && import.meta.hot.data) {
      import.meta.hot.data.showWorkbench = this.showWorkbench;
      import.meta.hot.data.currentView = this.currentView;
    }

    this.setupCoordination();
  }

  private setupCoordination() {
    this.currentView.listen((view) => {
      if (view === 'preview') {
        this.setPreviews();
      }
    });
  }

  /**
   * 手动设置页面数据，通常用于初始化页面数据。
   * @param pages 页面数据
   */
  setPages(pages: PageMap) {
    this.editorStore.setDocuments(pages, true);
    for (const [pageName, page] of Object.entries(pages)) {
      if (page) {
        this.pagesStore.setPage(pageName, page);
        this.pagesStore.savePageHistory(pageName, page.content as string, 'initial');
      }
    }

    if (this.pagesStore.pagesCount > 0 && this.editorStore.currentDocument.get() === undefined) {
      // 找到第一个页面并选中
      for (const [pageName] of Object.entries(pages)) {
        this.setSelectedPage(pageName);
        this.setActiveSectionByPageName(pageName);
        break;
      }
    }
  }

  setSelectedPage(pageName: string | undefined) {
    this.pagesStore.setActivePage(pageName);
  }

  setActiveSectionByPageName(pageName: string) {
    const page = this.pagesStore.getPage(pageName);
    if (page) {
      this.setActiveSection(page.actionIds[page.actionIds.length - 1]);
    }
  }

  setActiveSection(sectionId: string | undefined) {
    this.pagesStore.setActiveSection(sectionId);
  }

  setPreviews() {
    const documents = this.editorStore.editorDocuments.get();
    this.previewsStore.setPreviews(documents);

    const currentDocument = this.editorStore.currentDocument.get();
    if (currentDocument) {
      this.previewsStore.setCurrentPreviewName(currentDocument.name);
    }
  }

  setShowWorkbench(show: boolean) {
    this.showWorkbench.set(show);
  }

  async setDocumentContent(pageName: string, _html: string) {
    if (_html.trim() === '') {
      return;
    }
    // 更新内容，但不会触发保存，不会保存至 pages 中。
    this.editorStore.updateDocumentContent(pageName, _html);
  }

  async saveDocument(pageName: string, changeSource: ChangeSource) {
    const documents = this.editorStore.editorDocuments.get();
    const pageProperties = documents[pageName];
    if (pageProperties === undefined) {
      return;
    }

    let contentToSave = pageProperties.content as string;
    const page = this.pagesStore.getPage(pageName);
    const pageWithAssets = page as typeof page & { assets?: any[] };
    if (page && pageWithAssets.assets && pageWithAssets.assets.length > 0) {
      contentToSave = replaceUrlsWithRelativePaths(contentToSave, pageWithAssets.assets);
    }

    // 触发 page 的保存
    this.pagesStore.savePage(pageName, contentToSave, changeSource).then(() => {
      this.editorStore.removeUnsavedDocument(pageName, true);
    });
  }

  /**
   * 将当前页面重置为上次保存的状态。
   * @returns
   */
  resetCurrentPage() {
    const currentPage = this.editorStore.currentDocument.get();
    if (currentPage === undefined) {
      return;
    }

    const { name: pageName } = currentPage;
    const page = this.pagesStore.getPage(pageName as string);
    if (!page) {
      return;
    }
    this.editorStore.updateDocumentContent(pageName as string, page.content as string);
  }

  async saveAllPages(changeSource: ChangeSource) {
    for (const pageName of this.editorStore.unsavedDocuments.get()) {
      await this.saveDocument(pageName, changeSource);
    }
  }

  /**
   * 创建一个页面，通常由用户手动创建。
   * @param pageName 页面名称
   * @param pageTitle 页面标题
   * @returns 是否成功
   */
  async createPage(pageName: string, pageTitle = '未命名页面') {
    try {
      // 只需更新 pagesStore，Document 将会监听 pagesStore 的变化，并更新自身。
      return await this.pagesStore.createPage(pageName, pageTitle);
    } catch (error) {
      logger.error(`创建页面失败: ${error}`);
      throw error;
    }
  }

  /**
   * 删除一个页面，
   * @param pageName 页面名称
   * @returns 是否成功
   */
  async deletePage(pageName: string) {
    try {
      const currentDocument = this.editorStore.currentDocument.get();
      const isInCurrentPage = currentDocument?.name === pageName;
      const success = await this.pagesStore.deletePage(pageName);
      if (success) {
        if (isInCurrentPage) {
          const pages = this.pagesStore.pages.get();
          let nextPage: string | undefined = undefined;

          for (const [path] of Object.entries(pages)) {
            nextPage = path;
            break;
          }

          this.setSelectedPage(nextPage);
        }
      }

      return success;
    } catch (error) {
      logger.error(`删除页面失败: ${error}`);
      throw error;
    }
  }

  async exportToZip(prefix: string = 'upage_export') {
    try {
      const currentMessageId = this.chatStore.currentMessageId.get();
      if (!currentMessageId) {
        toast.error('没有找到当前消息');
        return;
      }

      const formData = new FormData();
      formData.append('messageId', currentMessageId);

      const response = await fetch('/api/project/export', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '导出失败');
      }

      // get ZIP file
      const blob = await response.blob();

      // download file
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${prefix}_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('导出成功');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logger.error(`导出 HTML 文件失败: ${errorMessage}`);
      toast.error(`导出 HTML 文件失败: ${errorMessage}`);
    }
  }
}

export const webBuilderStore = new WebBuilderStore();
