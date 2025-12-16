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

export type ChangeSource = 'user' | 'auto-save' | 'initial';

export interface PageHistoryVersion {
  // 版本号
  version: number;
  // 时间戳
  timestamp: number;
  // 内容
  content: string;
  // 变更来源
  changeSource: ChangeSource;
}

export interface PageHistory {
  // 最初的内容
  originalContent: string;
  // 最新修改时间
  latestModified: number;
  // 最新版本
  latestVersion: number;
  // 版本历史
  versions: PageHistoryVersion[];
}

export interface ParsedSection {
  content: string;
  domId: string;
  rootDomId: string;
  pageName: string;
  sort: number;
  type: 'html' | 'script' | 'style';
  actionId: string;
}
