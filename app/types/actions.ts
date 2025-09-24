import type { Change } from 'diff';

export interface Page {
  name: string;
  title: string;
  content?: string;
  actionIds: string[];
}

export interface Section {
  id: string;
  action: 'add' | 'update' | 'remove';
  pageName: string;
  content: string;
  domId: string;
  rootDomId: string;
  sort?: number;
}
export interface BaseAction {
  content: string;
}

/**
 * UPageAction 是 UPage 的 action 类型，由 AI 返回的结构化数据。
 */
export interface UPageAction extends Section {
  validRootDomId: boolean;
}

export type UPageActionData = UPageAction | BaseAction;

export interface ActionAlert {
  type: string;
  title: string;
  description: string;
  content: string;
  source?: 'preview';
}

export interface PageHistory {
  originalContent: string;
  lastModified: number;
  changes: Change[];
  versions: {
    timestamp: number;
    content: string;
  }[];

  // 记录变更来源
  changeSource?: 'user' | 'auto-save' | 'external';
}
