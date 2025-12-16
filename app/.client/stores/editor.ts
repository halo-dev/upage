import { atom, computed, type MapStore, map, type WritableAtom } from 'nanostores';
import type { Section } from '~/types/actions';
import type { DocumentProperties, Editor } from '~/types/editor';
import type { PageData, PageMap } from '~/types/pages';
import { replaceRelativePathsWithUrls } from '../utils/asset-path-converter';
import { convertPageHeadToHTML } from '../utils/html-parse';
import type { PagesStore } from './pages';

/**
 * 编辑器文档，结构为 <pageName, pageProperties>
 */
export type EditorDocuments = Record<string, DocumentProperties>;

type SelectedDocument = WritableAtom<string | undefined>;

export type EditorSection = Record<string, Section>;

// 编辑器命令类型
export type EditorCommandType = 'scrollToElement' | 'exportToZip';

// 编辑器命令接口
export interface EditorCommand {
  type: EditorCommandType;
  payload: any;
}

// 创建一个用于发送编辑器命令的atom
export const editorCommands = atom<EditorCommand | null>(null);

/**
 * 与 Editor 进行对接的 store。
 * 其内部保存的数据可以直接由 editor 使用与操作，并且当前数据与 editor 实时同步。
 */
export class EditorStore {
  private readonly pagesStore: PagesStore;

  editorInstance: WritableAtom<Editor | null> = import.meta.hot?.data?.editorInstance ?? atom<Editor | null>(null);
  // 编辑器中当前选中的文档。
  selectedDocument: SelectedDocument = import.meta.hot?.data?.selectedPage ?? atom<string | undefined>();
  // 编辑器文档数据，始终是与编辑器所保持的最新数据，但此数据不一定执行了保存。
  editorDocuments: MapStore<EditorDocuments> = import.meta.hot?.data?.documents ?? map({});
  // 当前编辑器文档，基于 editorDocuments 和 selectedDocument 计算而来。始终是与编辑器所保持的最新数据，但此数据不一定执行了保存。
  currentDocument = computed([this.editorDocuments, this.selectedDocument], (documents, selectedDocument) => {
    if (!selectedDocument) {
      return undefined;
    }
    return documents[selectedDocument];
  });
  // 当前编辑器未保存的页面
  unsavedDocuments: WritableAtom<Set<string>> = import.meta.hot?.data?.unsavedDocuments ?? atom(new Set<string>());
  // 编辑器文档最后保存时间
  documentLastSaved: WritableAtom<Record<string, number>> =
    import.meta.hot?.data?.documentLastSaved ?? atom<Record<string, number>>({});

  constructor(pagesStore: PagesStore) {
    this.pagesStore = pagesStore;

    if (import.meta.hot && import.meta.hot.data) {
      import.meta.hot.data.unsavedDocuments = this.unsavedDocuments;
      import.meta.hot.data.selectedDocument = this.selectedDocument;
      import.meta.hot.data.editorDocuments = this.editorDocuments;
      import.meta.hot.data.documentLastSaved = this.documentLastSaved;
    }

    this.setupCoordination();
  }

  private setupCoordination() {
    // 监听 pagesStore 的 pages 变化
    this.pagesStore.pages.listen((pages) => {
      this.setDocuments(pages);
    });

    // 监听 pagesStore 的 activePage 变化
    this.pagesStore.activePage.listen((pageName) => {
      this.selectedDocument.set(pageName);
    });
  }

  setEditorInstance(editor: Editor) {
    this.editorInstance.set(editor);
  }

  getEditorInstance() {
    return this.editorInstance.get();
  }

  setDocuments(pages: PageMap, updateContent: boolean = false) {
    const documents = this.editorDocuments.get();
    this.editorDocuments.set(
      Object.fromEntries<DocumentProperties>(
        Object.entries(pages)
          .map(([pageName, page]) => {
            if (page === undefined) {
              return undefined;
            }

            const oldDocument = documents[pageName];
            if (oldDocument && !updateContent) {
              return [pageName, { ...oldDocument, name: pageName, title: page.title }];
            }

            let convertedContent = page.content;
            const pageWithAssets = page as typeof page & { assets?: any[] };
            if (page.content && pageWithAssets.assets && pageWithAssets.assets.length > 0) {
              convertedContent = replaceRelativePathsWithUrls(page.content, pageWithAssets.assets);
            }

            return [
              pageName,
              {
                ...page,
                name: pageName,
                head: convertPageHeadToHTML(page as PageData),
                title: page.title,
                content: convertedContent,
              },
            ] as [string, DocumentProperties];
          })
          .filter(Boolean) as Array<[string, DocumentProperties]>,
      ),
    );
  }

  updatePageState(pageName: string, page: Omit<DocumentProperties, 'content'>) {
    const documents = this.editorDocuments.get();
    const oldDocumentState = documents[pageName];
    if (!oldDocumentState) {
      return;
    }

    const content = oldDocumentState.content;
    this.editorDocuments.setKey(pageName, { ...oldDocumentState, ...page, content });
  }

  updateDocumentContent(pageName: string, newContent: string) {
    const documents = this.editorDocuments.get();
    const oldDocumentState = documents[pageName];

    if (!oldDocumentState) {
      return;
    }

    const oldContent = oldDocumentState.content;
    const contentChanged = oldContent !== newContent;
    if (contentChanged) {
      this.editorDocuments.setKey(pageName, {
        ...oldDocumentState,
        content: newContent,
      });
    }
    this.updateUnsavedDocuments(pageName, newContent);
  }

  private updateUnsavedDocuments(pageName: string, newContent: string) {
    const savedContent = this.pagesStore.getPage(pageName)?.content;
    // 是否存在未保存的更改
    const unsavedChanges = savedContent === undefined || savedContent !== newContent;
    const currentDocument = this.currentDocument.get();
    if (!currentDocument) {
      return;
    }
    // 保存数据至未保存中
    const previousUnsavedPages = this.unsavedDocuments.get();
    // 如果已经将此页面标记为未保存，则不进行更新。
    if (unsavedChanges && previousUnsavedPages.has(pageName)) {
      return;
    }

    const newUnsavedPages = new Set(previousUnsavedPages);

    // 如果存在未保存的更改，则将此页面标记为未保存。否则，将此页面从未保存中移除。
    if (unsavedChanges) {
      newUnsavedPages.add(pageName);
    } else {
      newUnsavedPages.delete(pageName);
    }

    this.unsavedDocuments.set(newUnsavedPages);
  }

  removeUnsavedDocument(pageName: string, saved: boolean = false) {
    const newUnsavedPages = new Set(this.unsavedDocuments.get());
    newUnsavedPages.delete(pageName);
    this.unsavedDocuments.set(newUnsavedPages);

    if (!saved) {
      return;
    }
    // 记录保存时间
    const currentTime = Date.now();
    const lastSavedTimes = this.documentLastSaved.get();
    this.documentLastSaved.set({
      ...lastSavedTimes,
      [pageName]: currentTime,
    });
  }

  scrollToElement(domId: string) {
    editorCommands.set({
      type: 'scrollToElement',
      payload: { domId },
    });
  }
}
