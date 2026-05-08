import { JSDOM } from 'jsdom';
import { getMessageSections, type SectionCreateParams } from '~/.server/service/section';
import { isPatchAction, isRemovePageAction, type PatchOp, type PatchTarget, type UPageAction } from '~/types/actions';
import type { UPagePagePart, UserPageSnapshot } from '~/types/message';
import type { PageData } from '~/types/pages';
import { generateUUID } from '~/utils/uuid';

type DraftPageMap = Map<string, PageData>;
type DraftSectionMap = Map<string, SectionCreateParams>;

export type DraftProjectSnapshot = {
  anchorMessageId: string;
  pages: DraftPageMap;
  sections: DraftSectionMap;
};

export async function createDraftProjectSnapshot({
  anchorMessageId,
  pages,
  baselineMessageId,
  pageSnapshot,
}: {
  anchorMessageId: string;
  pages: PageData[];
  baselineMessageId?: string;
  pageSnapshot?: UserPageSnapshot;
}): Promise<DraftProjectSnapshot> {
  const pageMap: DraftPageMap = new Map(
    pages.map((page, index) => [
      page.name,
      {
        ...page,
        messageId: anchorMessageId,
        sort: page.sort ?? index,
      },
    ]),
  );

  const sectionMap: DraftSectionMap = new Map();
  const baselineSections = baselineMessageId ? await getMessageSections(baselineMessageId) : [];

  for (const section of baselineSections) {
    sectionMap.set(section.actionId, {
      id: section.actionId,
      messageId: anchorMessageId,
      action: section.action as UPageAction['action'],
      actionId: section.actionId,
      pageName: section.pageName,
      content: section.content,
      domId: section.domId,
      rootDomId: section.rootDomId || section.domId,
      sort: section.sort,
      placement: section.placement,
      type: section.type,
    });
  }

  for (const action of pageSnapshot?.actions || []) {
    sectionMap.set(action.id, toDraftSection(anchorMessageId, action));
  }

  recomputePageActionIds(pageMap, sectionMap);

  return {
    anchorMessageId,
    pages: pageMap,
    sections: sectionMap,
  };
}

export function applyPagePartToDraftProjectSnapshot(snapshot: DraftProjectSnapshot, page: UPagePagePart) {
  for (const action of page.actions) {
    if (isRemovePageAction(action)) {
      snapshot.pages.delete(action.pageName);
      removeSectionsForPage(snapshot.sections, action.pageName);
      continue;
    }

    const currentPage = snapshot.pages.get(action.pageName) || createEmptyDraftPage(snapshot.anchorMessageId, page);
    const materialized = materializeDraftAction(action, currentPage.content);
    const nextPage: PageData = {
      ...currentPage,
      name: action.pageName,
      title: page.artifact.title,
      messageId: snapshot.anchorMessageId,
      content: materialized.nextPageContent,
      sort: currentPage.sort ?? snapshot.pages.size,
    };

    snapshot.pages.set(action.pageName, nextPage);

    if (action.action === 'remove') {
      snapshot.sections.delete(action.id);
    } else {
      snapshot.sections.set(action.id, toDraftSection(snapshot.anchorMessageId, materialized.action));
    }
  }

  recomputePageActionIds(snapshot.pages, snapshot.sections);
}

export function serializeDraftProjectSnapshot(snapshot: DraftProjectSnapshot) {
  const pages = Array.from(snapshot.pages.values())
    .sort((left, right) => (left.sort ?? 0) - (right.sort ?? 0))
    .map((page) => ({
      ...page,
      messageId: snapshot.anchorMessageId,
    }));

  const sections = Array.from(snapshot.sections.values())
    .filter((section) => snapshot.pages.has(section.pageName))
    .sort((left, right) => (left.sort ?? 0) - (right.sort ?? 0))
    .map((section) => ({
      ...section,
      messageId: snapshot.anchorMessageId,
    }));

  return {
    pages,
    sections,
  };
}

function toDraftSection(messageId: string, action: UPageAction): SectionCreateParams {
  return {
    id: action.id,
    messageId,
    action: action.action,
    actionId: action.id,
    pageName: action.pageName,
    content: action.content,
    domId: action.domId,
    rootDomId: action.rootDomId || action.domId,
    sort: action.sort ?? 0,
    placement: 'body',
    type: 'section',
  };
}

function createEmptyDraftPage(messageId: string, page: UPagePagePart): PageData {
  return {
    id: generateUUID(),
    messageId,
    name: page.artifact.name,
    title: page.artifact.title,
    content: '',
    actionIds: [],
  };
}

function removeSectionsForPage(sections: DraftSectionMap, pageName: string) {
  for (const [actionId, section] of sections.entries()) {
    if (section.pageName === pageName) {
      sections.delete(actionId);
    }
  }
}

function recomputePageActionIds(pages: DraftPageMap, sections: DraftSectionMap) {
  const pageSections = new Map<string, SectionCreateParams[]>();

  for (const section of sections.values()) {
    const list = pageSections.get(section.pageName) || [];
    list.push(section);
    pageSections.set(section.pageName, list);
  }

  for (const [pageName, page] of pages.entries()) {
    const actionIds = (pageSections.get(pageName) || [])
      .sort((left, right) => (left.sort ?? 0) - (right.sort ?? 0))
      .map((section) => section.actionId);
    pages.set(pageName, {
      ...page,
      actionIds,
    });
  }
}

type MaterializedPageActionResult = {
  action: UPageAction;
  nextPageContent: string;
};

function materializeDraftAction(action: UPageAction, currentPageContent: string): MaterializedPageActionResult {
  const dom = new JSDOM('<!DOCTYPE html><body><div id="draft-root"></div></body>');
  const document = dom.window.document;
  const container = document.getElementById('draft-root');

  if (!container) {
    return {
      action,
      nextPageContent: currentPageContent,
    };
  }

  container.innerHTML = currentPageContent;

  if (!isPatchAction(action)) {
    applyHtmlAction(document, container, action);
    return {
      action: {
        ...action,
        contentKind: 'html',
      },
      nextPageContent: container.innerHTML,
    };
  }

  applyPatchOps(document, container, action.patches);

  return {
    action: buildMaterializedHtmlAction(container, action),
    nextPageContent: container.innerHTML,
  };
}

function buildMaterializedHtmlAction(container: HTMLElement, action: UPageAction): UPageAction {
  if (!isPatchAction(action)) {
    return {
      ...action,
      contentKind: 'html',
    };
  }

  const primaryDomId = getPrimaryDomId(action);
  const materializedNode = primaryDomId ? findByDomId(container, primaryDomId) : null;

  if (action.action === 'remove') {
    return {
      ...action,
      contentKind: 'html',
      content: '',
      patches: undefined,
      domId: primaryDomId || action.domId,
      rootDomId: primaryDomId || action.rootDomId || action.domId,
      validRootDomId: true,
    };
  }

  if (action.action === 'add') {
    const addedDomId = getInsertedRootDomId(action) || primaryDomId;
    const addedNode = addedDomId ? findByDomId(container, addedDomId) : materializedNode;

    return {
      ...action,
      contentKind: 'html',
      content: addedNode?.outerHTML || action.content,
      patches: undefined,
      domId: getPrimaryParentDomId(action) || action.domId,
      rootDomId: addedDomId || action.rootDomId || action.id,
      validRootDomId: Boolean(addedNode?.id || addedDomId),
    };
  }

  return {
    ...action,
    contentKind: 'html',
    content: materializedNode?.outerHTML || action.content,
    patches: undefined,
    domId: primaryDomId || action.domId,
    rootDomId: primaryDomId || action.rootDomId || action.domId,
    validRootDomId: Boolean(materializedNode?.id || primaryDomId),
  };
}

function applyHtmlAction(document: Document, container: HTMLElement, action: UPageAction) {
  switch (action.action) {
    case 'add':
      insertHtml(document, container, action.domId, action.content, action.sort);
      return;
    case 'update':
      replaceNode(document, container, { domId: action.domId }, action.content);
      return;
    case 'remove':
      removeNode(container, { domId: action.domId });
      return;
  }
}

function applyPatchOps(document: Document, container: HTMLElement, patches: PatchOp[]) {
  for (const patch of patches) {
    switch (patch.type) {
      case 'insert-node':
        insertHtml(
          document,
          container,
          patch.parentDomId,
          patch.html,
          patch.sort,
          patch.position,
          patch.relativeToDomId,
        );
        break;
      case 'replace-node':
        replaceNode(document, container, patch.target, patch.html);
        break;
      case 'remove-node':
        removeNode(container, patch.target);
        break;
      case 'remove-page':
        break;
      case 'move-node':
        moveNode(container, patch);
        break;
      case 'set-attr': {
        const target = findTarget(container, patch.target);
        target?.setAttribute(patch.name, patch.value);
        break;
      }
      case 'remove-attr': {
        const target = findTarget(container, patch.target);
        target?.removeAttribute(patch.name);
        break;
      }
      case 'set-text': {
        const target = findTarget(container, patch.target);
        if (target) {
          target.textContent = patch.text;
        }
        break;
      }
      case 'add-class': {
        const target = findTarget(container, patch.target);
        if (target) {
          const classesToAdd = patch.classes.split(/\s+/).filter(Boolean);
          target.classList.add(...classesToAdd);
        }
        break;
      }
      case 'remove-class': {
        const target = findTarget(container, patch.target);
        if (target) {
          const classesToRemove = patch.classes.split(/\s+/).filter(Boolean);
          target.classList.remove(...classesToRemove);
        }
        break;
      }
      case 'set-style': {
        const target = findTarget(container, patch.target);
        if (target) {
          (target as HTMLElement).style.setProperty(patch.property, patch.value);
        }
        break;
      }
      case 'remove-style': {
        const target = findTarget(container, patch.target);
        if (target) {
          (target as HTMLElement).style.removeProperty(patch.property);
        }
        break;
      }
    }
  }
}

function insertHtml(
  document: Document,
  container: HTMLElement,
  parentDomId: string,
  html: string,
  sort?: number,
  position?: 'append' | 'prepend' | 'before' | 'after',
  relativeToDomId?: string,
) {
  const newElement = createElementFromHtml(document, html);
  if (!newElement) {
    return;
  }

  const existingElement = newElement.id ? findByDomId(container, newElement.id) : null;
  const parent = parentDomId === 'main' ? container : findByDomId(container, parentDomId);
  if (!parent) {
    return;
  }

  if (existingElement && existingElement !== parent) {
    existingElement.remove();
  }

  if ((position === 'before' || position === 'after') && relativeToDomId) {
    const relativeTo = findByDomId(container, relativeToDomId);
    if (relativeTo?.parentElement) {
      if (position === 'before') {
        relativeTo.parentElement.insertBefore(newElement, relativeTo);
      } else {
        relativeTo.parentElement.insertBefore(newElement, relativeTo.nextSibling);
      }
      return;
    }
  }

  if (position === 'prepend') {
    parent.insertBefore(newElement, parent.firstChild);
    return;
  }

  if (typeof sort === 'number') {
    parent.insertBefore(newElement, parent.children[sort] || null);
    return;
  }

  parent.appendChild(newElement);
}

function replaceNode(document: Document, container: HTMLElement, target: PatchTarget, html: string) {
  const targetElement = findTarget(container, target);
  const replacement = createElementFromHtml(document, html);
  if (!targetElement || !replacement) {
    return;
  }

  targetElement.replaceWith(replacement);
}

function removeNode(container: HTMLElement, target: PatchTarget) {
  const targetElement = findTarget(container, target);
  targetElement?.remove();
}

function moveNode(container: HTMLElement, patch: Extract<PatchOp, { type: 'move-node' }>) {
  const target = findTarget(container, patch.target);
  if (!target) {
    return;
  }

  const parent = patch.parentDomId ? findByDomId(container, patch.parentDomId) : target.parentElement;
  if (!parent) {
    return;
  }

  if (patch.position === 'prepend') {
    parent.insertBefore(target, parent.firstChild);
    return;
  }

  if (typeof patch.sort === 'number') {
    parent.insertBefore(target, parent.children[patch.sort] || null);
    return;
  }

  parent.appendChild(target);
}

function createElementFromHtml(document: Document, html: string) {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  return temp.firstElementChild;
}

function findTarget(container: HTMLElement, target: PatchTarget) {
  const domTarget = findByDomId(container, target.domId);
  if (!domTarget) {
    return null;
  }

  if (!target.selector) {
    return domTarget;
  }

  return domTarget.matches(target.selector) ? domTarget : domTarget.querySelector(target.selector);
}

function findByDomId(container: ParentNode, domId: string) {
  if (domId === 'main') {
    return container instanceof Element ? container : null;
  }

  if ('getElementById' in container && typeof container.getElementById === 'function') {
    return container.getElementById(domId);
  }

  return container.querySelector(`#${escapeCssIdentifier(domId)}`);
}

function escapeCssIdentifier(value: string) {
  return value.replace(/([ #;?%&,.+*~\\':"!^$[\]()=>|/@])/g, '\\$1');
}

function getPrimaryDomId(action: UPageAction & { patches: PatchOp[] }) {
  for (const patch of action.patches || []) {
    if ('target' in patch && patch.target?.domId) {
      return patch.target.domId;
    }

    if ('parentDomId' in patch && patch.parentDomId) {
      return patch.parentDomId;
    }
  }

  return action.rootDomId || action.domId;
}

function getInsertedRootDomId(action: UPageAction & { patches: PatchOp[] }) {
  for (const patch of action.patches || []) {
    if (patch.type === 'insert-node') {
      const inserted = /id=(["'])([^"']+)\1/i.exec(patch.html);
      if (inserted?.[2]) {
        return inserted[2];
      }
    }
  }

  return undefined;
}

function getPrimaryParentDomId(action: UPageAction & { patches: PatchOp[] }) {
  for (const patch of action.patches || []) {
    if (patch.type === 'insert-node' && patch.parentDomId) {
      return patch.parentDomId;
    }
  }

  return undefined;
}
