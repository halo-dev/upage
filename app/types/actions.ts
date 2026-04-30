export interface Page {
  name: string;
  title: string;
  content?: string;
  actionIds: string[];
}

export type UPageActionType = 'add' | 'update' | 'remove';
export type UPageActionContentKind = 'html' | 'patch';

export type PatchTarget = {
  domId: string;
  selector?: string;
};

export type PatchInsertPosition = 'append' | 'prepend' | 'before' | 'after';

export type PatchOpBase = {
  opId: string;
  reason?: string;
};

export type InsertNodePatchOp = PatchOpBase & {
  type: 'insert-node';
  parentDomId: string;
  html: string;
  position?: PatchInsertPosition;
  relativeToDomId?: string;
  sort?: number;
};

export type ReplaceNodePatchOp = PatchOpBase & {
  type: 'replace-node';
  target: PatchTarget;
  html: string;
};

export type RemoveNodePatchOp = PatchOpBase & {
  type: 'remove-node';
  target: PatchTarget;
};

export type RemovePagePatchOp = PatchOpBase & {
  type: 'remove-page';
};

export type MoveNodePatchOp = PatchOpBase & {
  type: 'move-node';
  target: PatchTarget;
  parentDomId?: string;
  position?: Extract<PatchInsertPosition, 'append' | 'prepend'>;
  sort?: number;
};

export type SetAttrPatchOp = PatchOpBase & {
  type: 'set-attr';
  target: PatchTarget;
  name: string;
  value: string;
};

export type RemoveAttrPatchOp = PatchOpBase & {
  type: 'remove-attr';
  target: PatchTarget;
  name: string;
};

export type SetTextPatchOp = PatchOpBase & {
  type: 'set-text';
  target: PatchTarget;
  text: string;
};

export type PatchOp =
  | InsertNodePatchOp
  | ReplaceNodePatchOp
  | RemoveNodePatchOp
  | RemovePagePatchOp
  | MoveNodePatchOp
  | SetAttrPatchOp
  | RemoveAttrPatchOp
  | SetTextPatchOp;

export interface SectionBase {
  id: string;
  action: UPageActionType;
  pageName: string;
  content: string;
  domId: string;
  rootDomId: string;
  sort?: number;
  contentKind?: UPageActionContentKind;
  patches?: PatchOp[];
}

export interface Section extends SectionBase {}
export interface BaseAction {
  content: string;
}

/**
 * UPageAction 是 UPage 的 action 类型，由 AI 返回的结构化数据。
 */
export interface UPageAction extends SectionBase {
  validRootDomId: boolean;
}

export type UPageActionData = UPageAction | BaseAction;

export function isPatchAction(action: Pick<UPageAction, 'contentKind' | 'patches'>): action is UPageAction & {
  contentKind: 'patch';
  patches: PatchOp[];
} {
  return action.contentKind === 'patch' && Array.isArray(action.patches) && action.patches.length > 0;
}

export function isHtmlAction(action: Pick<UPageAction, 'contentKind'>): boolean {
  return action.contentKind !== 'patch';
}

export function isRemovePageAction(
  action: Pick<UPageAction, 'action' | 'contentKind' | 'patches'>,
): action is UPageAction & {
  action: 'remove';
  contentKind: 'patch';
  patches: PatchOp[];
} {
  return (
    action.action === 'remove' && isPatchAction(action) && action.patches.some((patch) => patch.type === 'remove-page')
  );
}

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
