import type { ActionState } from '../runtime/action-runner';

interface BridgeContext {
  loaded: boolean;
}

export const bridgeContext: BridgeContext = import.meta.hot?.data?.editorBridgeContext ?? {
  loaded: false,
};

if (import.meta.hot && import.meta.hot.data) {
  import.meta.hot.data.editorBridgeContext = bridgeContext;
}

export type EventPayload = {
  pageName: string;
} & Record<string, any>;
type EventHandler = (payload: EventPayload) => void;
type EventMap = Map<string, Set<EventHandler>>;

type Page = {
  name: string;
  title: string;
  actionIds?: string[];
};

type SectionProps = {
  id: string;
  pageName: string;
  content: string;
  domId: string;
  rootDomId: string;
  sort?: number;
};

/**
 * 构筑一个运行在 node 环境下的，editor 的 bridge。
 * 所有操作编辑器的方法，都需要经由此 bridge 进行广播。
 * 其内部所保存的 pages 与 sections 均为虚拟数据，与 editor 所需的实际数据有一定差异。
 */
export class EditorBridge {
  #pages: Map<string, Page> = new Map();
  #sections: Map<string, SectionProps> = new Map();
  #events: EventMap = new Map();
  #watchHandlers: Set<(event: { type: string; payload: EventPayload }) => void> = new Set();

  /**
   * 监听事件
   * @param event 事件名称
   * @param handler 处理函数
   */
  on(event: string, handler: EventHandler) {
    if (!this.#events.has(event)) {
      this.#events.set(event, new Set());
    }

    this.#events.get(event)?.add(handler);

    return this;
  }

  /**
   * 移除事件监听
   * @param event 事件名称
   * @param handler 处理函数
   */
  off(event: string, handler?: EventHandler) {
    if (!handler) {
      this.#events.delete(event);
    } else if (this.#events.has(event)) {
      this.#events.get(event)?.delete(handler);
    }

    return this;
  }

  /**
   * 触发事件
   * @param event 事件名称
   * @param payload 事件负载对象
   */
  #emit(event: string, payload: EventPayload) {
    this.#events.get(event)?.forEach((handler) => handler(payload));

    // 同时通知所有 watch 监听器
    this.#watchHandlers.forEach((handler) => handler({ type: event, payload }));
  }

  /**
   * 创建页面
   * @param pageName 页面名称
   */
  async createPage(name: string, { title, actionIds }: { title?: string; actionIds?: string[] } = {}) {
    const newPage: Page = { name, title: title ?? '未命名页面', actionIds: actionIds ?? [] };
    this.#pages.set(name, newPage);

    // 发出 add_page 事件，其他地方可通过 editorBridge.on('add_page', (payload) => {}) 监听
    this.#emit('add_page', {
      pageName: name,
      ...newPage,
    });
  }

  async removePage(pageName: string) {
    this.#pages.delete(pageName);

    // 发出 remove_page 事件，其他地方可通过 editorBridge.on('remove_page', (payload) => {}) 监听
    this.#emit('remove_page', { pageName });
  }

  async updateSection(action: ActionState) {
    this.#sections.set(action.id, action);
    // 发出 add_page_section 事件，其他地方可通过 editorBridge.on('add_page_section', (payload) => {}) 监听
    this.#emit('update_section', { pageName: action.pageName, id: action.id, section: action });
  }

  async upsertPageAction(pageName: string, pageTitle: string, actionId: string) {
    const page = this.#pages.get(pageName);
    const pageProps = page
      ? {
          ...page,
          actionIds: [...(page.actionIds ?? []), actionId],
        }
      : {
          name: pageName,
          title: pageTitle || '未命名页面',
          actionIds: [actionId],
        };
    pageProps.actionIds = [...new Set(pageProps.actionIds)];

    this.#pages.set(pageName, pageProps);
    // 发出 update_page 事件，其他地方可通过 editorBridge.on('update_page', (payload) => {}) 监听
    this.#emit('upsert_page', {
      pageName,
      ...pageProps,
    });
  }

  // /**
  //  * 获取页面历史记录
  //  * @param pageName 页面名称
  //  * @returns 页面历史
  //  */
  // async getPageHistory(pageName: string): Promise<string> {
  //   return this.#pages.get(pageName) || '{}';
  // }

  /**
   * 监听所有事件
   * @param handler 处理所有事件的函数
   */
  watch(handler: (event: { type: string; payload: EventPayload }) => void) {
    this.#watchHandlers.add(handler);

    return this;
  }

  /**
   * 移除 watch 监听
   * @param handler 处理函数
   */
  unwatch(handler: (event: { type: string; payload: EventPayload }) => void) {
    this.#watchHandlers.delete(handler);
    return this;
  }
}

export let editorBridge: Promise<EditorBridge> = new Promise(() => {
  // noop for ssr
});

if (!import.meta.env.SSR) {
  editorBridge =
    import.meta.hot?.data?.editorBridge ??
    Promise.resolve()
      .then(() => {
        return new EditorBridge();
      })
      .then(async (editorBridge) => {
        bridgeContext.loaded = true;
        return editorBridge;
      });

  if (import.meta.hot && import.meta.hot.data) {
    import.meta.hot.data.editorBridge = editorBridge;
  }
}
