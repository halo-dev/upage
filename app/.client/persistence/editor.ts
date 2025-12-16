import { useSearchParams } from '@remix-run/react';
import { getChatId } from '~/.client/stores/ai-state';
import { createScopedLogger } from '~/.client/utils/logger';
import type { Page, Section } from '~/types/actions';
import type { PageAssetData, PageData } from '~/types/pages';
import { generateUUID } from '~/utils/uuid';

/**
 * 序列化标记常量
 */
export const SERIALIZATION_MARKERS = {
  FUNCTION_PREFIX: '__FUNCTION__:',
  ABORT_SIGNAL_PREFIX: '__ABORT_SIGNAL__',
  ABORT_CONTROLLER_PREFIX: '__ABORT_CONTROLLER__',
};
/**
 * 将对象序列化为可存储在 IndexedDB 中的格式
 * 将函数转换为特殊格式的字符串
 * @param data 需要序列化的数据
 * @returns 序列化后的数据（可存储在 IndexedDB 中）
 */
function serializeForIndexedDB<T>(data: T): any {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'function') {
    const funcStr = data.toString();
    if (funcStr.includes('abortController.abort()')) {
      return `${SERIALIZATION_MARKERS.FUNCTION_PREFIX}abort`;
    }
    return `${SERIALIZATION_MARKERS.FUNCTION_PREFIX}${funcStr}`;
  }

  if (data && typeof data === 'object' && 'aborted' in data && 'onabort' in data) {
    return SERIALIZATION_MARKERS.ABORT_SIGNAL_PREFIX;
  }

  if (data && typeof data === 'object' && 'signal' in data && 'abort' in data) {
    return SERIALIZATION_MARKERS.ABORT_CONTROLLER_PREFIX;
  }

  if (data instanceof Date) {
    return {
      __type: 'Date',
      value: data.toISOString(),
    };
  }

  if (Array.isArray(data)) {
    return data.map((item) => serializeForIndexedDB(item));
  }

  if (typeof data === 'object') {
    const serializedObject: Record<string, any> = {};

    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        serializedObject[key] = serializeForIndexedDB((data as Record<string, any>)[key]);
      }
    }

    return serializedObject;
  }

  return data;
}

/**
 * 将从 IndexedDB 中读取的数据反序列化
 * 将特殊格式的字符串转换回函数
 * @param data 需要反序列化的数据
 * @returns 反序列化后的数据
 */
function deserializeFromIndexedDB<T>(data: any): T {
  if (data === null || data === undefined) {
    return data as T;
  }

  if (typeof data === 'string') {
    if (data.startsWith(SERIALIZATION_MARKERS.FUNCTION_PREFIX)) {
      const funcBody = data.substring(SERIALIZATION_MARKERS.FUNCTION_PREFIX.length);

      if (funcBody === 'abort') {
        const abortController = new AbortController();
        return function () {
          abortController.abort();
        } as unknown as T;
      }

      try {
        return new Function(`return ${funcBody}`)() as T;
      } catch (error) {
        console.error('Failed to deserialize function:', error);
        return (() => {
          // ignore error
          return undefined;
        }) as unknown as T;
      }
    }

    if (data === SERIALIZATION_MARKERS.ABORT_SIGNAL_PREFIX) {
      return new AbortController().signal as unknown as T;
    }

    if (data === SERIALIZATION_MARKERS.ABORT_CONTROLLER_PREFIX) {
      return new AbortController() as unknown as T;
    }
  }

  if (data && typeof data === 'object') {
    if (data.__type === 'Date' && data.value) {
      return new Date(data.value) as unknown as T;
    }

    if (Array.isArray(data)) {
      return data.map((item) => deserializeFromIndexedDB(item)) as unknown as T;
    }

    const deserializedObject: Record<string, any> = {};

    for (const key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) {
        deserializedObject[key] = deserializeFromIndexedDB(data[key]);
      }
    }

    return deserializedObject as T;
  }

  return data as T;
}

/**
 * Editor message project data structure
 *
 * Compatibility notes:
 * - pages: old version page data (only used for reading history data)
 * - pagesV2: new version page data (new data saved to this field)
 * - sections: page section data (used with both old and new versions)
 */
export interface IEditorMessageProject {
  messageId: string;
  // old version page data (only used for reading)
  pages: Page[];
  // page section data
  sections: Section[];
  // new version page data (used for saving)
  pagesV2?: PageData[];
}

export interface IProject {
  id: string;
  messageProjects: IEditorMessageProject[];
  timestamp: string;
}

const logger = createScopedLogger('EditorProjects');

/**
 * Open editor local database.
 * @returns editor 本地数据库。
 */
export async function openEditorDatabase(): Promise<IDBDatabase | undefined> {
  if (typeof indexedDB === 'undefined') {
    logger.error('indexedDB 在当前环境中不可用');
    return undefined;
  }

  return new Promise((resolve) => {
    const request = indexedDB.open('editorProjects', 1);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const oldVersion = event.oldVersion;

      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains('projects')) {
          const store = db.createObjectStore('projects', { keyPath: 'id' });
          store.createIndex('id', 'id', { unique: true });
        }
      }
    };

    request.onsuccess = (event: Event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event: Event) => {
      resolve(undefined);
      logger.error((event.target as IDBOpenDBRequest).error);
    };
  });
}

/**
 * Save project data (new version, using PageV2 structure)
 *
 * @param db IndexedDB database instance
 * @param messageId message ID
 * @param pagesV2 new version page data (PageV2)
 * @param sections page section data
 *
 * @note new data is only saved to pagesV2 field, pages field is set to an empty array to maintain structural compatibility
 */
export async function saveProject(
  db: IDBDatabase,
  messageId: string,
  pagesV2: PageData[],
  sections: Section[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    // serialize data, handle non-serializable content
    const serializedPagesV2 = serializeForIndexedDB(pagesV2);
    const serializedSections = serializeForIndexedDB(sections);

    const transaction = db.transaction('projects', 'readwrite');
    const store = transaction.objectStore('projects');

    // first try to get existing record
    const getRequest = store.get(getChatId()!);

    getRequest.onsuccess = () => {
      const existingData = getRequest.result as IProject | undefined;
      const timestamp = new Date().toISOString();

      if (existingData) {
        /*
         * 如果记录存在
         * 检查是否已存在相同 messageId 的项目
         */
        const existingIndex = existingData.messageProjects.findIndex((p) => p.messageId === messageId);

        let messageProjects;

        if (existingIndex !== -1) {
          // if the same messageId project is found, update it
          messageProjects = existingData.messageProjects.map((p, index) =>
            index === existingIndex
              ? {
                  ...p,
                  pages: [],
                  sections: serializedSections,
                  pagesV2: serializedPagesV2,
                }
              : p,
          );
        } else {
          // if no project with the same messageId is found, add a new project
          messageProjects = [
            ...existingData.messageProjects,
            {
              messageId,
              pages: [],
              sections: serializedSections,
              pagesV2: serializedPagesV2,
            },
          ];
        }

        const updatedData = {
          ...existingData,
          messageProjects,
          timestamp,
        };

        const putRequest = store.put(updatedData);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      } else {
        // create new record
        const newData: IProject = {
          id: getChatId()!,
          messageProjects: [
            {
              messageId,
              pages: [],
              sections: serializedSections,
              pagesV2: serializedPagesV2,
            },
          ],
          timestamp,
        };

        const putRequest = store.put(newData);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      }
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

export async function setEditorProjects(db: IDBDatabase, id: string, projects: IEditorMessageProject[]): Promise<void> {
  return new Promise((resolve, reject) => {
    // 序列化项目数据，处理不可序列化的内容
    const serializedProjects = serializeForIndexedDB(projects);

    const transaction = db.transaction('projects', 'readwrite');
    const store = transaction.objectStore('projects');
    const request = store.put({
      id,
      messageProjects: serializedProjects,
      timestamp: new Date().toISOString(),
    });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get editor project data (supports new and old versions)
 *
 * @param db IndexedDB database instance
 * @param chatId chat ID
 * @returns project data, containing new and old versions
 */
export async function getEditorProjects(db: IDBDatabase, chatId: string): Promise<IProject> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('projects', 'readonly');
    const store = transaction.objectStore('projects');
    const request = store.get(chatId);

    request.onsuccess = () => {
      const project = request.result as IProject;

      if (project && project.messageProjects) {
        const deserializedProject = {
          ...project,
          messageProjects: project.messageProjects.map((mp) => ({
            ...mp,
            pages: mp.pages ? deserializeFromIndexedDB<Page[]>(mp.pages) : [],
            sections: mp.sections ? deserializeFromIndexedDB<Section[]>(mp.sections) : [],
            pagesV2: mp.pagesV2 ? deserializeFromIndexedDB<PageData[]>(mp.pagesV2) : undefined,
          })),
        };
        resolve(deserializedProject);
      } else {
        resolve(project);
      }
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Get project data (supports new and old versions)
 *
 * @param db IndexedDB database instance
 * @param messageId message ID (optional, if not provided, return the latest project data)
 * @returns project data, containing new and old versions
 *
 * @note return pagesV2 first, if not exists, return old version pages (backward compatibility)
 */
export async function getEditorProject(
  db: IDBDatabase,
  messageId?: string,
): Promise<
  | {
      sections: Section[] | undefined;
      pages?: PageData[];
      assets?: PageAssetData[];
      project?: IProject;
    }
  | undefined
> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('projects', 'readonly');
    const store = transaction.objectStore('projects');
    const request = store.get(getChatId()!);

    request.onsuccess = () => {
      const project = request.result as IProject;

      if (!project) {
        resolve(undefined);
        return;
      }

      if (messageId) {
        // return project data for specific message ID
        const data = project.messageProjects?.find((p) => p.messageId === messageId);

        const deserializedPages = data?.pages ? deserializeFromIndexedDB<Page[]>(data.pages) : [];
        const deserializedSections = data?.sections ? deserializeFromIndexedDB<Section[]>(data.sections) : undefined;
        const deserializedPagesV2 = data?.pagesV2 ? deserializeFromIndexedDB<PageData[]>(data.pagesV2) : undefined;
        const pagesV2: PageData[] = deserializedPages.map((page) => ({
          id: generateUUID(),
          messageId: data?.messageId ?? '',
          name: page.name,
          title: page.title,
          content: page.content ?? '',
          actionIds: page.actionIds,
        }));

        resolve({
          pages: deserializedPagesV2 || pagesV2,
          sections: deserializedSections,
          project,
        });
      } else {
        // if no message ID is specified, return the latest project data
        const messageIds = project.messageProjects.map((p) => p.messageId);

        if (messageIds.length === 0) {
          resolve({ pages: [], sections: undefined, project });
        } else {
          // sort by timestamp (if timestamp exists), or take the last one
          const lastMessageId = messageIds[messageIds.length - 1];
          const lastMessageProject = project.messageProjects.find((p) => p.messageId === lastMessageId);

          const deserializedPages = lastMessageProject?.pages
            ? deserializeFromIndexedDB<Page[]>(lastMessageProject.pages)
            : [];
          const deserializedSections = lastMessageProject?.sections
            ? deserializeFromIndexedDB<Section[]>(lastMessageProject.sections)
            : undefined;
          const deserializedPagesV2 = lastMessageProject?.pagesV2
            ? deserializeFromIndexedDB<PageData[]>(lastMessageProject.pagesV2)
            : undefined;

          const pagesV2: PageData[] = deserializedPages.map((page) => ({
            id: generateUUID(),
            messageId: lastMessageProject?.messageId ?? '',
            name: page.name,
            title: page.title,
            content: page.content ?? '',
            actionIds: page.actionIds,
          }));

          resolve({
            pages: deserializedPagesV2 || pagesV2,
            sections: deserializedSections,
            project,
          });
        }
      }
    };

    request.onerror = () => reject(request.error);
  });
}

// 删除项目数据
export async function deleteEditorProject(db: IDBDatabase, chatId: string, messageId?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('projects', 'readwrite');
    const store = transaction.objectStore('projects');

    if (messageId) {
      // 只删除特定消息 ID 的项目数据
      const getRequest = store.get(chatId);

      getRequest.onsuccess = () => {
        const project = getRequest.result as IProject;

        if (project && project.messageProjects && project.messageProjects.find((p) => p.messageId === messageId)) {
          // 删除特定消息的项目数据
          project.messageProjects = project.messageProjects.filter((p) => p.messageId !== messageId);

          if (project.messageProjects.length === 0) {
            // 如果没有剩余项目，删除整个记录
            const deleteRequest = store.delete(chatId);
            deleteRequest.onsuccess = () => resolve();
            deleteRequest.onerror = () => reject(deleteRequest.error);
          } else {
            // 更新记录
            project.timestamp = new Date().toISOString();

            const putRequest = store.put(project);
            putRequest.onsuccess = () => resolve();
            putRequest.onerror = () => reject(putRequest.error);
          }
        } else {
          resolve(); // 项目不存在或消息 ID 不存在，视为删除成功
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    } else {
      // 删除整个聊天 ID 的所有项目数据
      const request = store.delete(chatId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    }
  });
}

// 获取所有项目数据
export async function getAllEditorProjects(db: IDBDatabase): Promise<IProject[]> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('projects', 'readonly');
    const store = transaction.objectStore('projects');
    const request = store.getAll();

    request.onsuccess = () => {
      const projects = request.result as IProject[];
      resolve(projects);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function createEditorProjectFromMessages(
  db: IDBDatabase,
  chatId: string,
  messageProjects: IEditorMessageProject[],
): Promise<void> {
  await setEditorProjects(db, chatId, messageProjects);
}

export async function forkEditorProject(
  db: IDBDatabase,
  chatId: string,
  newChatId: string,
  messageId?: string,
): Promise<void> {
  const project = await getEditorProjects(db, chatId);
  if (!project) {
    console.warn('editor project not found, It may be old project data.');
    return;
  }

  const messageIndex = messageId
    ? project.messageProjects.findIndex((msg) => msg.messageId === messageId)
    : project.messageProjects.length - 1;

  if (messageIndex === -1) {
    throw new Error('Message not found');
  }

  const messages = project.messageProjects.slice(0, messageIndex + 1);

  await createEditorProjectFromMessages(db, newChatId, messages);
}

export async function duplicateEditorProject(db: IDBDatabase, id: string, newChatId: string): Promise<void> {
  const project = await getEditorProjects(db, id);
  if (!project) {
    console.warn('editor project not found, It may be old project data.');
    return;
  }

  createEditorProjectFromMessages(db, newChatId, project.messageProjects);
}

/**
 * Hook used in editor, for saving and loading project data
 *
 * @note new version uses PageV2 structure to save data, old version uses Page structure when reading
 */
export function useEditorStorage() {
  const [searchParams] = useSearchParams();
  const currentMessageId = searchParams.get('rewindTo');

  /**
   * Save project to local database (using PageV2 structure)
   *
   * @param messageId message ID
   * @param pagesV2 new version page data
   * @param sections page section data
   * @returns whether the project is saved successfully
   */
  const saveEditorProject = async (messageId: string | undefined, pagesV2: PageData[], sections: Section[]) => {
    const db = await openEditorDatabase();

    if (!db || !messageId) {
      return false;
    }

    try {
      await saveProject(db, messageId, pagesV2, sections);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logger.error(`保存 editor 项目失败: ${errorMessage}`);
      return false;
    } finally {
      db.close();
    }
  };

  /**
   * Load editor project
   *
   * @returns editor project data
   *
   * @note the project data will be converted to PageV2 structure
   * @note the project data returned contains the PageV2 structure in the pages field, the Section structure in the sections field, the PageAssetData structure in the assets field, and the IProject structure in the project field
   */
  const loadEditorProject = async (): Promise<
    | {
        pages?: PageData[];
        sections?: Section[];
        assets?: PageAssetData[];
        project?: IProject;
      }
    | undefined
  > => {
    const db = await openEditorDatabase();

    if (!db) {
      return undefined;
    }

    const messageId = currentMessageId || undefined;
    try {
      const result = await getEditorProject(db, messageId);
      if (!result) {
        return undefined;
      }

      return {
        pages: result.pages,
        sections: result.sections,
        assets: result.assets,
        project: result.project,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      logger.error(`加载 editor 项目失败: ${errorMessage}`);
      return undefined;
    } finally {
      db.close();
    }
  };

  return {
    saveEditorProject,
    loadEditorProject,
  };
}
