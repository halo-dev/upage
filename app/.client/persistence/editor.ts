import { useSearchParams } from '@remix-run/react';
import { getChatId } from '~/.client/stores/ai-state';
import { createScopedLogger } from '~/.client/utils/logger';
import type { Page, Section } from '~/types/actions';

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

export interface IEditorMessageProject {
  messageId: string;
  pages: Page[];
  sections: Section[];
}

export interface IProject {
  id: string;
  messageProjects: IEditorMessageProject[];
  timestamp: string;
}

const logger = createScopedLogger('EditorProjects');

/**
 * 打开 editor 本地数据库。
 * @returns editor 本地数据库。
 */
export async function openEditorDatabase(): Promise<IDBDatabase | undefined> {
  if (typeof indexedDB === 'undefined') {
    logger.debug('indexedDB 在当前环境中不可用');
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

// 保存项目数据
export async function saveProject(
  db: IDBDatabase,
  messageId: string,
  pages: Page[],
  sections: Section[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    // 序列化数据，处理不可序列化的内容
    const serializedPages = serializeForIndexedDB(pages);
    const serializedSections = serializeForIndexedDB(sections);

    const transaction = db.transaction('projects', 'readwrite');
    const store = transaction.objectStore('projects');

    // 首先尝试获取现有记录
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
          // 如果找到了相同 messageId 的项目，则更新它
          messageProjects = existingData.messageProjects.map((p, index) =>
            index === existingIndex ? { ...p, pages: serializedPages, sections: serializedSections } : p,
          );
        } else {
          // 如果没有找到相同 messageId 的项目，则添加新项目
          messageProjects = [
            ...existingData.messageProjects,
            { messageId, pages: serializedPages, sections: serializedSections },
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
        // 创建新记录
        const newData: IProject = {
          id: getChatId()!,
          messageProjects: [{ messageId, pages: serializedPages, sections: serializedSections }],
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

// 获取项目数据
export async function getEditorProject(
  db: IDBDatabase,
  messageId?: string,
): Promise<{ pages: Page[]; sections: Section[] | undefined; project?: IProject } | undefined> {
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
        // 返回特定消息 ID 的项目数据
        const data = project.messageProjects?.find((p) => p.messageId === messageId);

        const deserializedPages = data?.pages ? deserializeFromIndexedDB<Page[]>(data.pages) : [];
        const deserializedSections = data?.sections ? deserializeFromIndexedDB<Section[]>(data.sections) : undefined;

        resolve({
          pages: deserializedPages,
          sections: deserializedSections,
          project,
        });
      } else {
        // 没有指定消息 ID，返回最新的项目数据
        const messageIds = project.messageProjects.map((p) => p.messageId);

        if (messageIds.length === 0) {
          resolve({ pages: [], sections: undefined, project });
        } else {
          // 按时间戳排序（如果有时间戳），或者取最后一个
          const lastMessageId = messageIds[messageIds.length - 1];
          const lastMessageProject = project.messageProjects.find((p) => p.messageId === lastMessageId);

          const deserializedPages = lastMessageProject?.pages
            ? deserializeFromIndexedDB<Page[]>(lastMessageProject.pages)
            : [];
          const deserializedSections = lastMessageProject?.sections
            ? deserializeFromIndexedDB<Section[]>(lastMessageProject.sections)
            : undefined;

          resolve({
            pages: deserializedPages,
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
  messageId: string,
  newChatId: string,
): Promise<void> {
  const project = await getEditorProjects(db, chatId);
  if (!project) {
    console.warn('editor project not found, It may be old project data.');
    return;
  }

  const messageIndex = project.messageProjects.findIndex((msg) => msg.messageId === messageId);

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

// 在 GrapesEditor 中使用的Hook
export function useEditorStorage() {
  const [searchParams] = useSearchParams();
  const currentMessageId = searchParams.get('rewindTo');

  // 保存项目至本地数据库
  const saveEditorProject = async (messageId: string | undefined, pages: Page[], sections: Section[]) => {
    const db = await openEditorDatabase();

    if (!db || !messageId) {
      return false;
    }

    try {
      await saveProject(db, messageId, pages, sections);
      return true;
    } catch (error) {
      logger.error('保存 editor 项目失败', error);
      return false;
    } finally {
      db.close();
    }
  };

  /**
   * 加载 editor 项目。
   * @returns editor 项目数据。
   */
  const loadEditorProject = async (): Promise<Page[] | undefined> => {
    const db = await openEditorDatabase();

    if (!db) {
      return undefined;
    }

    const messageId = currentMessageId || undefined;
    try {
      const result = await getEditorProject(db, messageId);
      return result?.pages;
    } catch (error) {
      logger.error('加载 editor 项目失败', error);
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
