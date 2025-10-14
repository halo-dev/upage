import { diffLines } from 'diff';
import { atom, computed, type MapStore, map, type WritableAtom } from 'nanostores';
import { type EditorBridge, type EventPayload, editorBridge } from '~/.client/bridge';
import { computePageModifications, diffPages } from '~/.client/utils/diff';
import { isValidContent } from '~/.client/utils/html-parse';
import type { ChangeSource, Page, PageHistory } from '~/types/actions';
import type { PageMap, PageSection, SectionMap } from '~/types/pages';
import { createScopedLogger } from '~/utils/logger';
import { normalizeContent } from '~/utils/prettier';

const logger = createScopedLogger('PagesStore');

type ActiveSection = WritableAtom<string | undefined>;
type ActivePage = WritableAtom<string | undefined>;

/**
 * 保存与 AI 交互的页面数据， AI 生成的页面数据会保存在此处。
 * 当用户在两个消息之间修改 editor 时，也会讲修改的页面和内容保存在此处。
 */
export class PagesStore {
  private readonly editorBridge: Promise<EditorBridge> = editorBridge;

  /**
   * 跟踪页面数量
   */
  private size = 0;

  /**
   * @note 跟踪所有自上次用户消息以来被修改的文件及其原始内容，以便模型感知这些更改。
   * 当用户发送另一条消息且所有更改都需要提交时，需要重置。
   */
  private modifiedPages: Map<string, string> = import.meta.hot?.data?.modifiedPages ?? new Map();

  /**
   * 跟踪已删除的页面，防止它们在重新加载时重新出现
   */
  private deletedPages: Set<string> = import.meta.hot?.data?.deletedPages ?? new Set();

  /**
   * 页面映射，与 AI 做交互，基于 artifacts 数据解析而来。
   * 因此，此数据表示与数据库通信的底层数据，未保存的数据将不会在此处体现。
   * 如果在编辑器中确定保存了数据，则需要实时同步进 #modifiedPages 中。
   */
  pages: MapStore<PageMap> = import.meta.hot?.data?.pages ?? map({});

  /**
   * 页面历史记录，用于 diff 视图。
   * 每次页面保存时，会保存上一次的页面内容。
   */
  pageHistory: MapStore<Record<string, PageHistory>> = import.meta.hot?.data?.pageHistory ?? map({});

  activePage: ActivePage = import.meta.hot?.data?.activePage ?? atom<string | undefined>();
  currentPage = computed([this.pages, this.activePage], (pages, activePage) => {
    if (!activePage) {
      return undefined;
    }

    return pages[activePage];
  });
  /**
   * 基于 action 的 section 映射，作为与 AI 交互的底层数据，基于 actions 数据解析而来。
   */
  sections: MapStore<SectionMap> = import.meta.hot?.data?.sections ?? map({});
  /**
   * 当前活跃的 section。
   */
  activeSection: ActiveSection = import.meta.hot?.data?.activeSection ?? atom<string | undefined>();

  currentSection = computed([this.sections, this.activeSection], (sections, activeSection) => {
    if (!activeSection) {
      return undefined;
    }

    return sections[activeSection];
  });

  get pagesCount() {
    return this.size;
  }

  constructor() {
    // Load deleted paths from localStorage if available
    try {
      if (typeof localStorage !== 'undefined') {
        const deletedPagesJson = localStorage.getItem('upage-deleted-pages');

        if (deletedPagesJson) {
          const deletedPages = JSON.parse(deletedPagesJson);

          if (Array.isArray(deletedPages)) {
            deletedPages.forEach((path) => this.deletedPages.add(path));
          }
        }
      }
    } catch (error) {
      logger.error('Failed to load deleted paths from localStorage', error);
    }

    if (import.meta.hot && import.meta.hot.data) {
      // Persist our state across hot reloads
      import.meta.hot.data.pages = this.pages;
      import.meta.hot.data.modifiedPages = this.modifiedPages;
      import.meta.hot.data.deletedPages = this.deletedPages;
      import.meta.hot.data.sections = this.sections;
      import.meta.hot.data.pageHistory = this.pageHistory;
    }

    this.#init();
    this.setupCoordination();
  }

  private setupCoordination() {
    this.sections.listen(() => {
      const currentPage = this.activePage.get();

      if (currentPage && this.currentSection.get() === undefined) {
        const pageActions = this.getPage(currentPage)?.actionIds;
        if (pageActions) {
          this.setActiveSection(pageActions[pageActions.length - 1]);
        }
      }
    });
  }

  getPage(pageName: string) {
    return this.pages.get()[pageName];
  }

  getPageModifications() {
    return computePageModifications(this.pages.get(), this.modifiedPages);
  }

  getModifiedPages() {
    let modifiedPages: { [pageName: string]: Page } | undefined = undefined;

    for (const [pageName, originalContent] of this.modifiedPages) {
      const page = this.pages.get()[pageName];
      if (!page) {
        continue;
      }

      if (page.content === originalContent) {
        continue;
      }

      if (!modifiedPages) {
        modifiedPages = {};
      }

      modifiedPages[pageName] = page;
    }

    return modifiedPages;
  }

  resetPageModifications() {
    this.modifiedPages.clear();
  }

  async savePage(pageName: string, content: string, changeSource: ChangeSource) {
    const page = this.getPage(pageName);
    if (!page) {
      return false;
    }
    try {
      this.pages.setKey(pageName, { ...page, content });
      logger.info('Page updated');
      // 保存上一次的页面内容
      this.savePageHistory(pageName, content, changeSource);
    } catch (error) {
      logger.error('Failed to update page content\n\n', error);
      throw error;
    }
  }

  async savePageHistory(pageName: string, newContent: string, changeSource: ChangeSource) {
    const page = this.getPage(pageName);
    if (!page) {
      return;
    }
    const pageHistory = this.pageHistory.get()[pageName];
    // 如果不存在历史记录，则创建一个新的历史记录
    if (!pageHistory) {
      const newHistory: PageHistory = {
        originalContent: newContent,
        latestVersion: 1,
        latestModified: Date.now(),
        versions: [
          {
            version: 1,
            timestamp: Date.now(),
            content: newContent,
            changeSource,
          },
        ],
      };
      this.pageHistory.setKey(pageName, newHistory);
      return;
    }

    const lastVersion = pageHistory.versions.find((version) => version.version === pageHistory.latestVersion);
    if (!lastVersion) {
      return;
    }
    // 如果存在历史记录，则检查自上次版本以来是否有实际变化
    const originalContent = lastVersion?.content || page.content!;
    if (!originalContent) {
      return;
    }
    const normalizedCurrentContent = normalizeContent(newContent);
    const normalizedLastContent = normalizeContent(lastVersion?.content);
    if (normalizedCurrentContent === normalizedLastContent) {
      return;
    }

    const unifiedDiff = diffPages(pageName, lastVersion.content, newContent);
    if (!unifiedDiff) {
      return;
    }
    const newChanges = diffLines(lastVersion.content, newContent);

    // 检查是否有显著变化
    const hasSignificantChanges = newChanges.some(
      (change) => (change.added || change.removed) && change.value.trim().length > 0,
    );
    if (!hasSignificantChanges) {
      return;
    }

    const newHistory: PageHistory = {
      originalContent: pageHistory.originalContent,
      latestVersion: pageHistory.latestVersion + 1,
      latestModified: Date.now(),
      versions: [
        ...pageHistory.versions,
        {
          version: pageHistory.latestVersion + 1,
          timestamp: Date.now(),
          content: newContent,
          changeSource,
        },
      ].slice(-20), // 只保留最近的 20 个版本
    };

    this.pageHistory.setKey(pageName, newHistory);
  }

  async #init() {
    const grapesBridge = await this.editorBridge;

    this.#cleanupDeletedPages();

    grapesBridge.watch(({ type, payload }) => this.#processGrapesBridgeEvent(type, payload));
  }

  /**
   * Removes any deleted files/folders from the store
   */
  #cleanupDeletedPages() {
    if (this.deletedPages.size === 0) {
      return;
    }

    const currentPages = this.pages.get();

    for (const deletedPageName of this.deletedPages) {
      if (currentPages[deletedPageName]) {
        this.pages.setKey(deletedPageName, undefined);
        this.size--;
      }

      for (const [path] of Object.entries(currentPages)) {
        if (path.startsWith(deletedPageName + '/')) {
          this.pages.setKey(path, undefined);

          this.size--;

          if (this.modifiedPages.has(path)) {
            this.modifiedPages.delete(path);
          }
        }
      }
    }
  }

  #processGrapesBridgeEvent(type: string, payload: EventPayload) {
    const { pageName } = payload;

    // Skip processing if this page was explicitly deleted
    if (this.deletedPages.has(pageName)) {
      return;
    }

    switch (type) {
      case 'add_page': {
        const { title: pageTitle, actionIds = [] } = payload;
        const oldPage = this.pages.get()[pageName];
        if (oldPage) {
          throw new Error(`Page ${pageName} already exists`);
        }

        this.pages.setKey(pageName, {
          name: pageName,
          title: pageTitle,
          content: '',
          actionIds,
        });

        this.size++;
        logger.info(`Page created: ${pageName}`);
        break;
      }
      case 'upsert_page': {
        const { title: pageTitle, actionIds = [] } = payload;
        const oldPage = this.pages.get()[pageName];
        this.pages.setKey(pageName, {
          name: pageName,
          title: pageTitle,
          actionIds: actionIds || oldPage?.actionIds,
          content: oldPage?.content,
        });
        break;
      }
      case 'remove_page': {
        this.deletedPages.add(pageName);

        this.pages.setKey(pageName, undefined);
        this.size--;

        if (this.modifiedPages.has(pageName)) {
          this.modifiedPages.delete(pageName);
        }

        this.#persistDeletedPages();

        logger.info(`Page deleted: ${pageName}`);
        break;
      }
      case 'update_section': {
        const { id, section } = payload;
        this.sections.setKey(id, { id, type: 'section', ...section });
        break;
      }
    }
  }

  async createPage(pageName: string, pageTitle: string) {
    await this.editorBridge.then((grapesBridge) => grapesBridge.createPage(pageName, { title: pageTitle }));
    return true;
  }

  async deletePage(pageName: string) {
    await this.editorBridge.then((grapesBridge) => grapesBridge.removePage(pageName));
    return true;
  }

  // method to persist deleted paths to localStorage
  #persistDeletedPages() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('upage-deleted-pages', JSON.stringify([...this.deletedPages]));
      }
    } catch (error) {
      logger.error('Failed to persist deleted paths to localStorage', error);
    }
  }

  updateSection(actionId: string, sectionContent: string) {
    const sections = this.sections.get();
    const sectionState = sections[actionId];
    if (!sectionState) {
      return;
    }

    const oldContent = sectionState.content;
    const contentChanged = oldContent !== sectionContent;

    if (contentChanged) {
      this.sections.setKey(actionId, { ...sectionState, content: sectionContent });
    }
    this.updateSectionRootDomId(actionId, sectionState, sectionContent);
  }

  private updateSectionRootDomId(actionId: string, section: PageSection, sectionContent: string) {
    if (section.validRootDomId) {
      return;
    }
    if (section.action === 'remove') {
      this.sections.setKey(actionId, { ...section, rootDomId: section.domId, validRootDomId: true });
      return;
    }
    const isValid = isValidContent(sectionContent);
    if (!isValid) {
      return;
    }
    const div = document.createElement('div');
    div.innerHTML = sectionContent;
    const rootDomId = div.firstElementChild?.id;
    if (!rootDomId) {
      return;
    }
    const oldRootDomId = section.rootDomId;
    if (oldRootDomId && oldRootDomId === rootDomId) {
      this.sections.setKey(actionId, { ...section, validRootDomId: true });
    } else {
      this.sections.setKey(actionId, { ...section, rootDomId });
    }
  }

  setActiveSection(sectionId: string | undefined) {
    this.activeSection.set(sectionId);
  }

  setActivePage(pageName: string | undefined) {
    this.activePage.set(pageName);
  }

  setPage(pageName: string, page: Page) {
    const oldPage = this.getPage(pageName);
    if (!oldPage) {
      return;
    }
    this.pages.setKey(pageName, { ...oldPage, ...page });
  }
}
