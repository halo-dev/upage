import { Octokit, type RestEndpointMethodTypes } from '@octokit/rest';
import Cookies from 'js-cookie';
import JSZip from 'jszip';
import { atom, type WritableAtom } from 'nanostores';
import { toast } from 'sonner';
import type { Page } from '~/types/actions';
import { base64ToBinary, getContentType, getExtensionFromMimeType, getFileName } from '~/utils/file-utils';
import { createScopedLogger } from '~/utils/logger';
import { formatFile } from '~/utils/prettier';
import { ChatStore } from './chat';
import { EditorStore } from './editor';
import { type PageMap, PagesStore } from './pages';
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
        this.getProjectFiles({ pathMode: 'absolute' }).then((files) => {
          this.setPreviews(files);
        });
      }
    });
  }

  setPages(pages: PageMap) {
    this.editorStore.setDocuments(pages, true);
    for (const [pageName, page] of Object.entries(pages)) {
      if (page) {
        this.pagesStore.setPage(pageName, page);
      }
    }

    if (this.pagesStore.pagesCount > 0 && this.editorStore.currentDocument.get() === undefined) {
      // 找到第一个页面并选中
      for (const [pageName] of Object.entries(pages)) {
        this.setSelectedPage(pageName);
        break;
      }
    }
  }

  setSelectedPage(pageName: string | undefined) {
    this.pagesStore.setActivePage(pageName);

    if (pageName) {
      const page = this.pagesStore.getPage(pageName);
      if (page) {
        this.setActiveSection(page.actionIds[page.actionIds.length - 1]);
      }
    }
  }

  setActiveSection(sectionId: string | undefined) {
    this.pagesStore.setActiveSection(sectionId);
  }

  setPreviews(files: ExportEditorFile[]) {
    this.previewsStore.setPreviews(files);

    const currentDocument = this.editorStore.currentDocument.get();
    const pageName = currentDocument?.name;
    if (pageName) {
      this.previewsStore.setCurrentPreview(`${pageName}.html`);
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

  /**
   * 执行保存，将 editorStore 中的当前页面内容同步保存至 PagesStore 中。
   * @returns
   */
  async saveCurrentDocument() {
    const currentPage = this.editorStore.currentDocument.get();
    if (!currentPage) {
      return;
    }

    this.saveDocument(currentPage.name as string);
  }

  async saveDocument(pageName: string) {
    const documents = this.editorStore.editorDocuments.get();
    const pageProperties = documents[pageName];
    if (pageProperties === undefined) {
      return;
    }
    // 触发 page 的保存
    this.pagesStore.savePage(pageName, pageProperties.content as string).then(() => {
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

  async saveAllPages() {
    for (const pageName of this.editorStore.unsavedDocuments.get()) {
      await this.saveDocument(pageName);
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
      console.error('Failed to create page:', error);
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
      console.error('Failed to delete page:', error);
      throw error;
    }
  }

  async pushToGitHub(repoName: string, commitMessage?: string, githubUsername?: string, ghToken?: string) {
    try {
      // Use cookies if username and token are not provided
      const githubToken = ghToken || Cookies.get('githubToken');
      const owner = githubUsername || Cookies.get('githubUsername');

      if (!githubToken || !owner) {
        throw new Error('GitHub token or username is not set in cookies or provided.');
      }

      // Initialize Octokit with the auth token
      const octokit = new Octokit({ auth: githubToken });

      // Check if the repository already exists before creating it
      let repo: RestEndpointMethodTypes['repos']['get']['response']['data'];

      try {
        const resp = await octokit.repos.get({ owner, repo: repoName });
        repo = resp.data;
      } catch (error) {
        if (error instanceof Error && 'status' in error && error.status === 404) {
          // Repository doesn't exist, so create a new one
          const { data: newRepo } = await octokit.repos.createForAuthenticatedUser({
            name: repoName,
            private: false,
            auto_init: true,
          });
          repo = newRepo;
        } else {
          console.log('cannot create repo!');
          throw error; // Some other error occurred
        }
      }

      // Get all pages
      const pages = await this.getProjectFilesAsMap({
        inline: false,
      });
      if (!pages || Object.keys(pages).length === 0) {
        throw new Error('No pages found to push');
      }

      // Create blobs for each file
      const blobs = await Promise.all(
        Object.entries(pages).map(async ([path, content]) => {
          if (path && content) {
            const formatContent = await formatFile(path, content);
            const { data: blob } = await octokit.git.createBlob({
              owner: repo.owner.login,
              repo: repo.name,
              content: Buffer.from(formatContent).toString('base64'),
              encoding: 'base64',
            });
            return { path, sha: blob.sha };
          }

          return null;
        }),
      );

      const validBlobs = blobs.filter(Boolean); // Filter out any undefined blobs

      if (validBlobs.length === 0) {
        throw new Error('No valid files to push');
      }

      // Get the latest commit SHA (assuming main branch, update dynamically if needed)
      const { data: ref } = await octokit.git.getRef({
        owner: repo.owner.login,
        repo: repo.name,
        ref: `heads/${repo.default_branch || 'main'}`, // Handle dynamic branch
      });
      const latestCommitSha = ref.object.sha;

      // Create a new tree
      const { data: newTree } = await octokit.git.createTree({
        owner: repo.owner.login,
        repo: repo.name,
        base_tree: latestCommitSha,
        tree: validBlobs.map((blob) => ({
          path: blob!.path,
          mode: '100644',
          type: 'blob',
          sha: blob!.sha,
        })),
      });

      // Create a new commit
      const { data: newCommit } = await octokit.git.createCommit({
        owner: repo.owner.login,
        repo: repo.name,
        message: commitMessage || 'Initial commit from your app',
        tree: newTree.sha,
        parents: [latestCommitSha],
      });

      // Update the reference
      await octokit.git.updateRef({
        owner: repo.owner.login,
        repo: repo.name,
        ref: `heads/${repo.default_branch || 'main'}`, // Handle dynamic branch
        sha: newCommit.sha,
      });
    } catch (error) {
      console.error('Error pushing to GitHub:', error);
      throw error; // Rethrow the error for further handling
    }
  }

  async exportToZip(prefix: string = 'upage_export') {
    try {
      const projectFiles = await this.getProjectFiles({ inline: false });
      if (projectFiles.length === 0) {
        toast.error('没有可导出的文件');
        return;
      }

      const zip = new JSZip();
      projectFiles.forEach((file: ExportEditorFile) => {
        if (file.mimeType?.startsWith('text/') || file.filename.endsWith('.js')) {
          zip.file(file.filename, file.content);
        } else {
          zip.file(file.filename, file.content, { binary: true });
        }
      });

      const zipBlob = await zip.generateAsync({ type: 'blob' });

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${prefix}_${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      logger.error('导出 HTML 文件失败', error);
      toast.error('导出 HTML 文件失败');
    }
  }

  async getProjectFilesAsMap(options: GetProjectFilesOptions = {}): Promise<Record<string, string>> {
    const files = await this.getProjectFiles(options);
    return files.reduce(
      (acc, file) => {
        acc[file.filename] = file.content;
        return acc;
      },
      {} as Record<string, string>,
    );
  }

  /**
   * 获取当前编辑器中的文件。
   * @param inline 是否内联样式及所有图片。如果为 false，则将提取所有本地资源为单独文件。默认为 true。
   * @param pathMode HTML 内的文件路径模式，默认为相对路径。
   * @returns 文件列表。
   */
  async getProjectFiles({
    inline = true,
    pathMode = 'relative',
  }: GetProjectFilesOptions = {}): Promise<ExportEditorFile[]> {
    const getFiles = async () => {
      const files: ExportEditorFile[] = [];
      for (const page of Object.values(this.pagesStore.pages.get())) {
        if (!page) {
          continue;
        }
        const doc = this.createProjectHead(page, pathMode);
        const pageElement = document.createElement('div');
        pageElement.id = page.name;
        pageElement.innerHTML = page.content || '';
        doc.body.innerHTML = pageElement.innerHTML;

        const file = {
          filename: `${page.name}.html`,
          content: '',
          mimeType: 'text/html',
        };

        if (inline) {
          file.content = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
          files.push(file);
        } else {
          const extractedFiles = await this.extractResources(pageElement);
          doc.body.innerHTML = pageElement.innerHTML;
          file.content = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
          files.push(file);
          files.push(...extractedFiles);
        }
      }

      return files;
    };

    const files: ExportEditorFile[] = await getFiles();

    if (!inline) {
      const tailwindContent = await fetch('/tailwindcss.js').then((resp) => resp.text());
      files.push({
        filename: 'tailwindcss.js',
        content: tailwindContent,
        mimeType: 'application/javascript',
      });
      const iconifyContent = await fetch('/iconify-icon.min.js').then((resp) => resp.text());
      files.push({
        filename: 'iconify-icon.min.js',
        content: iconifyContent,
        mimeType: 'application/javascript',
      });
    }

    return files;
  }

  private createProjectHead(page: Page, pathMode: 'relative' | 'absolute' = 'relative'): Document {
    const basePath = pathMode === 'relative' ? './' : '/';
    const doc = document.implementation.createHTMLDocument('');
    const head = doc.head;

    const meta = doc.createElement('meta');
    meta.setAttribute('charset', 'UTF-8');
    head.appendChild(meta);

    const viewport = doc.createElement('meta');
    viewport.setAttribute('name', 'viewport');
    viewport.setAttribute('content', 'width=device-width, initial-scale=1.0');
    head.appendChild(viewport);

    const title = doc.createElement('title');
    title.textContent = page.title || 'UPage Generated Page';
    head.appendChild(title);

    const tailwindScript = doc.createElement('script');
    tailwindScript.setAttribute('src', `${basePath}tailwindcss.js`);
    head.appendChild(tailwindScript);

    const iconifyScript = doc.createElement('script');
    iconifyScript.setAttribute('src', `${basePath}iconify-icon.min.js`);
    head.appendChild(iconifyScript);

    return doc;
  }

  /**
   * 提取资源为单独文件
   * @param doc HTML 文档
   * @returns 提取的文件列表
   */
  private async extractResources(doc: Element, assetsFolder: string = 'assets'): Promise<ExportEditorFile[]> {
    const files: ExportEditorFile[] = [];

    const resources: {
      element: Element;
      attribute: string;
      value: string;
    }[] = [];
    doc.querySelectorAll('*').forEach((element) => {
      const src = element.getAttribute('src');
      if (src) {
        resources.push({
          element,
          attribute: 'src',
          value: src,
        });
      }
      const href = element.getAttribute('href');
      if (href && element.tagName === 'LINK') {
        resources.push({
          element,
          attribute: 'href',
          value: href,
        });
      }
      const background = element.getAttribute('background');
      if (background) {
        resources.push({
          element,
          attribute: 'background',
          value: background,
        });
      }
      const backgroundImage = element.getAttribute('background-image');
      if (backgroundImage) {
        resources.push({
          element,
          attribute: 'background-image',
          value: backgroundImage,
        });
      }
    });

    for (const resource of resources) {
      if (this.isRemoteUrl(resource.value) || this.isAnchor(resource.value)) {
        continue;
      }

      if (resource.value.startsWith('data:')) {
        const mimeType = resource.value.split(';')[0].split(':')[1];
        const base64Content = resource.value.split(',')[1];
        const filename = `${assetsFolder}/${Date.now()}${getExtensionFromMimeType(mimeType)}`;
        resource.element.setAttribute(resource.attribute, `./${filename}`);

        // 将 base64 转换为二进制字符串
        const binaryString = base64ToBinary(base64Content);
        files.push({
          filename,
          content: binaryString,
          mimeType,
        });
        continue;
      }

      try {
        const response = await fetch(resource.value, {
          headers: {
            'Content-Type': getContentType(resource.value),
          },
        });
        if (!response.ok) {
          logger.error(`Failed to fetch resource: ${resource.value} (status: ${response.status})`);
          continue;
        }
        const filename = `${assetsFolder}/${getFileName(resource.value)}`;
        resource.element.setAttribute(resource.attribute, `./${filename}`);

        const mimeType = getContentType(resource.value);
        let content: string;

        if (this.isTextMimeType(mimeType)) {
          content = await response.text();
        } else {
          const buffer = await response.arrayBuffer();
          const array = new Uint8Array(buffer);
          content = Array.from(array)
            .map((byte) => String.fromCharCode(byte))
            .join('');
        }

        files.push({
          filename,
          content,
          mimeType,
        });
      } catch (error) {
        logger.error(`Error fetching resource: ${resource.value}`, error);
        continue;
      }
    }
    return files;
  }

  /**
   * 检查 URL 是否为远程 URL（以 http:// 或 https:// 开头）
   * @param url 要检查的 URL
   * @returns 是否为远程 URL
   */
  private isRemoteUrl(url: string): boolean {
    return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//');
  }

  private isAnchor(url: string): boolean {
    return url.startsWith('#');
  }

  /**
   * 判断是否为文本类型的 MIME 类型
   * @param mimeType MIME 类型
   * @returns 是否为文本类型
   */
  private isTextMimeType(mimeType: string): boolean {
    return (
      mimeType.startsWith('text/') ||
      mimeType === 'application/javascript' ||
      mimeType === 'application/json' ||
      mimeType === 'application/xml'
    );
  }
}

export const webBuilderStore = new WebBuilderStore();
