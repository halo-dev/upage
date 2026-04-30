import { isPatchAction, type PatchOp, type PatchTarget, type UPageAction } from '~/types/actions';

export type MaterializedPageActionResult = {
  action: UPageAction;
  nextPageContent: string;
};

export function materializePageAction(action: UPageAction, currentPageContent: string): MaterializedPageActionResult {
  const container = document.createElement('div');
  container.innerHTML = currentPageContent;

  if (!isPatchAction(action)) {
    applyHtmlAction(container, action);
    return {
      action: {
        ...action,
        contentKind: 'html',
      },
      nextPageContent: container.innerHTML,
    };
  }

  applyPatchOps(container, action.patches);

  return {
    action: buildMaterializedHtmlAction(container, action),
    nextPageContent: container.innerHTML,
  };
}

function buildMaterializedHtmlAction(container: HTMLDivElement, action: UPageAction): UPageAction {
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

function applyHtmlAction(container: HTMLDivElement, action: UPageAction) {
  switch (action.action) {
    case 'add':
      insertHtml(container, action.domId, action.content, action.sort);
      return;
    case 'update':
      replaceNode(container, { domId: action.domId }, action.content);
      return;
    case 'remove':
      removeNode(container, { domId: action.domId });
      return;
  }
}

function applyPatchOps(container: HTMLDivElement, patches: PatchOp[]) {
  for (const patch of patches) {
    switch (patch.type) {
      case 'insert-node':
        insertHtml(container, patch.parentDomId, patch.html, patch.sort, patch.position, patch.relativeToDomId);
        break;
      case 'replace-node':
        replaceNode(container, patch.target, patch.html);
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
    }
  }
}

function insertHtml(
  container: HTMLDivElement,
  parentDomId: string,
  html: string,
  sort?: number,
  position?: 'append' | 'prepend' | 'before' | 'after',
  relativeToDomId?: string,
) {
  const newElement = createElementFromHtml(html);
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

function replaceNode(container: HTMLDivElement, target: PatchTarget, html: string) {
  const targetElement = findTarget(container, target);
  const replacement = createElementFromHtml(html);
  if (!targetElement || !replacement) {
    return;
  }

  targetElement.replaceWith(replacement);
}

function removeNode(container: HTMLDivElement, target: PatchTarget) {
  const targetElement = findTarget(container, target);
  targetElement?.remove();
}

function moveNode(container: HTMLDivElement, patch: Extract<PatchOp, { type: 'move-node' }>) {
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

function createElementFromHtml(html: string) {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  return temp.firstElementChild;
}

function findTarget(container: HTMLDivElement, target: PatchTarget) {
  const domTarget = findByDomId(container, target.domId);
  if (!domTarget) {
    return null;
  }

  if (!target.selector) {
    return domTarget;
  }

  return domTarget.matches(target.selector) ? domTarget : domTarget.querySelector(target.selector);
}

function findByDomId(container: HTMLDivElement, domId: string) {
  return container.querySelector(`[id="${escapeAttributeValue(domId)}"]`);
}

function escapeAttributeValue(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function getInsertedRootDomId(action: UPageAction) {
  if (!isPatchAction(action)) {
    return extractRootElementId(action.content);
  }

  const insertPatch = action.patches.find((patch) => patch.type === 'insert-node');
  if (!insertPatch) {
    return undefined;
  }

  return extractRootElementId(insertPatch.html);
}

function getPrimaryParentDomId(action: UPageAction) {
  if (!isPatchAction(action)) {
    return action.domId;
  }

  const insertPatch = action.patches.find((patch) => patch.type === 'insert-node');
  return insertPatch?.parentDomId || action.domId;
}

function getPrimaryDomId(action: UPageAction) {
  if (!isPatchAction(action)) {
    return action.rootDomId || action.domId;
  }

  if (action.action === 'update') {
    return action.rootDomId || action.domId;
  }

  if (action.action === 'remove') {
    for (const patch of action.patches) {
      if ('target' in patch) {
        return patch.target.domId;
      }
    }

    return action.rootDomId || action.domId;
  }

  for (const patch of action.patches) {
    if (patch.type === 'insert-node') {
      return extractRootElementId(patch.html) || action.rootDomId || action.domId;
    }

    if ('target' in patch) {
      return patch.target.domId;
    }
  }

  return action.rootDomId || action.domId;
}

function extractRootElementId(content: string): string | undefined {
  const match = content.match(/^\s*<[\w:-]+\b[^>]*\bid=(["'])([^"']+)\1/i);
  return match?.[2];
}
