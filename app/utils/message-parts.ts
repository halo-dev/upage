import type { UPageAction, UPageActionType } from '~/types/actions';
import type { UPageArtifactData } from '~/types/artifact';
import type {
  ChatUIMessage,
  PartialPatchOp,
  PartialPatchTarget,
  PatchOp,
  RenderableStructuredPageSource,
} from '~/types/message-protocol';
import type { UPagePagePart } from '~/types/page-builder-tools';

export function isUpageToolPart(
  part: ChatUIMessage['parts'][number],
): part is Extract<ChatUIMessage['parts'][number], { type: 'tool-upage' }> {
  return part.type === 'tool-upage';
}

export function getUpageToolPartPages(
  part: Extract<ChatUIMessage['parts'][number], { type: 'tool-upage' }>,
): UPagePagePart[] {
  if (part.state === 'output-available') {
    return part.output.pages || [];
  }

  if (part.state === 'input-available' || part.state === 'input-streaming') {
    return extractUpageInputPages(part.input);
  }

  return [];
}

export function getUpageToolPartOutputPages(
  part: Extract<ChatUIMessage['parts'][number], { type: 'tool-upage' }>,
): UPagePagePart[] {
  return part.state === 'output-available' ? part.output.pages || [] : [];
}

export function getCompletedUpageToolPartPages(
  part: Extract<ChatUIMessage['parts'][number], { type: 'tool-upage' }>,
): UPagePagePart[] {
  if (part.state !== 'output-available') {
    return [];
  }

  const outputPages = part.output.pages || [];
  if (outputPages.length > 0) {
    return outputPages;
  }

  return extractUpageInputPages(part.input);
}

export function getUpageToolPartInputPages(
  part: Extract<ChatUIMessage['parts'][number], { type: 'tool-upage' }>,
): UPagePagePart[] {
  return part.state === 'input-available' || part.state === 'input-streaming' ? extractUpageInputPages(part.input) : [];
}

export function extractStructuredPageParts(message: Pick<ChatUIMessage, 'parts'>): UPagePagePart[] {
  const toolOutputPages: UPagePagePart[] = [];
  const toolInputPages: UPagePagePart[] = [];
  const dataPages: UPagePagePart[] = [];

  for (const part of message.parts || []) {
    if (part.type === 'data-upage-page') {
      dataPages.push(part.data);
      continue;
    }

    if (!isUpageToolPart(part)) {
      continue;
    }

    if (part.state === 'output-available') {
      toolOutputPages.push(...getCompletedUpageToolPartPages(part));
      continue;
    }

    if (part.state === 'input-available' || part.state === 'input-streaming') {
      toolInputPages.push(...extractUpageInputPages(part.input));
    }
  }

  if (toolOutputPages.length > 0) {
    return toolOutputPages;
  }

  if (toolInputPages.length > 0) {
    return toolInputPages;
  }

  return dataPages;
}

export function extractRenderableStructuredPageParts(message: Pick<ChatUIMessage, 'parts'>): UPagePagePart[] {
  const toolOutputPages: UPagePagePart[] = [];
  const dataPages: UPagePagePart[] = [];

  for (const part of message.parts || []) {
    if (part.type === 'data-upage-page') {
      dataPages.push(part.data);
      continue;
    }

    if (!isUpageToolPart(part)) {
      continue;
    }

    toolOutputPages.push(...getCompletedUpageToolPartPages(part));
  }

  if (toolOutputPages.length > 0) {
    return toolOutputPages;
  }

  return dataPages;
}

export function getStructuredPageSource(
  message: Pick<ChatUIMessage, 'parts'>,
): RenderableStructuredPageSource | undefined {
  for (const part of message.parts || []) {
    if (isUpageToolPart(part) && getCompletedUpageToolPartPages(part).length > 0) {
      return 'tool-upage-output';
    }
  }

  for (const part of message.parts || []) {
    if (part.type === 'data-upage-page') {
      return 'data-upage-page';
    }
  }

  return undefined;
}

export function hasStructuredPageParts(message: Pick<ChatUIMessage, 'parts'>): boolean {
  return extractRenderableStructuredPageParts(message).length > 0;
}

export function hasUpageBlockParts(message: Pick<ChatUIMessage, 'parts'>): boolean {
  return (message.parts || []).some(
    (part) => part.type === 'data-upage-block-start' || part.type === 'data-upage-block-complete',
  );
}

function extractUpageInputPages(input: unknown): UPagePagePart[] {
  if (!input || typeof input !== 'object' || !('pages' in input) || !Array.isArray(input.pages)) {
    return [];
  }

  return input.pages.map(normalizePartialPagePart).filter((page): page is UPagePagePart => page !== null);
}

function normalizePartialPagePart(page: unknown): UPagePagePart | null {
  if (!page || typeof page !== 'object' || !('artifact' in page) || !('actions' in page)) {
    return null;
  }

  const candidate = page as {
    artifact: unknown;
    actions: unknown;
    summary?: unknown;
  };
  const artifact = normalizeArtifact((page as { artifact: unknown }).artifact);
  const actions = normalizeActions((page as { actions: unknown }).actions);

  if (!artifact) {
    return null;
  }

  return {
    artifact,
    actions,
    summary: typeof candidate.summary === 'string' ? candidate.summary : undefined,
  };
}

function normalizeArtifact(artifact: unknown): UPageArtifactData | null {
  if (!artifact || typeof artifact !== 'object') {
    return null;
  }

  const candidate = artifact as Partial<UPageArtifactData>;
  if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string' || typeof candidate.title !== 'string') {
    return null;
  }

  return {
    id: candidate.id,
    name: candidate.name,
    title: candidate.title,
  };
}

function normalizeActions(actions: unknown): UPageAction[] {
  if (!Array.isArray(actions)) {
    return [];
  }

  const normalizedActions: UPageAction[] = [];

  for (const action of actions) {
    if (!action || typeof action !== 'object') {
      continue;
    }

    const candidate = action as Partial<UPageAction>;
    if (
      typeof candidate.id !== 'string' ||
      !isValidActionType(candidate.action) ||
      typeof candidate.pageName !== 'string'
    ) {
      continue;
    }

    const domId = typeof candidate.domId === 'string' && candidate.domId.trim() ? candidate.domId : 'main';
    const rootDomId =
      typeof candidate.rootDomId === 'string' && candidate.rootDomId.trim()
        ? candidate.rootDomId
        : typeof candidate.id === 'string'
          ? candidate.id
          : domId;

    const contentKind = candidate.contentKind === 'patch' ? 'patch' : 'html';
    const content = typeof candidate.content === 'string' ? candidate.content : '';
    const patches = contentKind === 'patch' ? normalizePatchOps(candidate.patches) : undefined;
    if (contentKind === 'patch' && (!patches || patches.length === 0)) {
      continue;
    }

    normalizedActions.push({
      id: candidate.id,
      action: candidate.action,
      pageName: candidate.pageName,
      content,
      domId,
      rootDomId,
      sort: typeof candidate.sort === 'number' ? candidate.sort : undefined,
      validRootDomId: candidate.validRootDomId === true,
      contentKind,
      patches,
    });
  }

  return normalizedActions;
}

function isValidActionType(value: unknown): value is UPageActionType {
  return value === 'add' || value === 'update' || value === 'remove';
}

function normalizePatchOps(patches: unknown): PatchOp[] {
  if (!Array.isArray(patches)) {
    return [];
  }

  const normalized: PatchOp[] = [];

  for (const patch of patches) {
    if (!patch || typeof patch !== 'object') {
      continue;
    }

    const candidate = patch as PartialPatchOp;
    const opId = typeof candidate.opId === 'string' && candidate.opId.trim() ? candidate.opId : undefined;
    const reason = typeof candidate.reason === 'string' && candidate.reason.trim() ? candidate.reason : undefined;

    if (!opId || typeof candidate.type !== 'string') {
      continue;
    }

    switch (candidate.type) {
      case 'insert-node': {
        if (typeof candidate.parentDomId !== 'string' || typeof candidate.html !== 'string') {
          continue;
        }

        normalized.push({
          type: 'insert-node',
          opId,
          reason,
          parentDomId: candidate.parentDomId,
          html: candidate.html,
          position: normalizeInsertPosition(candidate.position),
          relativeToDomId: typeof candidate.relativeToDomId === 'string' ? candidate.relativeToDomId : undefined,
          sort: typeof candidate.sort === 'number' ? candidate.sort : undefined,
        });
        continue;
      }
      case 'replace-node': {
        const target = normalizePatchTarget(candidate.target);
        if (!target || typeof candidate.html !== 'string') {
          continue;
        }

        normalized.push({
          type: 'replace-node',
          opId,
          reason,
          target,
          html: candidate.html,
        });
        continue;
      }
      case 'remove-node': {
        const target = normalizePatchTarget(candidate.target);
        if (!target) {
          continue;
        }

        normalized.push({
          type: 'remove-node',
          opId,
          reason,
          target,
        });
        continue;
      }
      case 'remove-page': {
        normalized.push({
          type: 'remove-page',
          opId,
          reason,
        });
        continue;
      }
      case 'move-node': {
        const target = normalizePatchTarget(candidate.target);
        if (!target) {
          continue;
        }

        normalized.push({
          type: 'move-node',
          opId,
          reason,
          target,
          parentDomId: typeof candidate.parentDomId === 'string' ? candidate.parentDomId : undefined,
          position:
            candidate.position === 'append' || candidate.position === 'prepend' ? candidate.position : undefined,
          sort: typeof candidate.sort === 'number' ? candidate.sort : undefined,
        });
        continue;
      }
      case 'set-attr': {
        const target = normalizePatchTarget(candidate.target);
        if (!target || typeof candidate.name !== 'string' || typeof candidate.value !== 'string') {
          continue;
        }

        normalized.push({
          type: 'set-attr',
          opId,
          reason,
          target,
          name: candidate.name,
          value: candidate.value,
        });
        continue;
      }
      case 'remove-attr': {
        const target = normalizePatchTarget(candidate.target);
        if (!target || typeof candidate.name !== 'string') {
          continue;
        }

        normalized.push({
          type: 'remove-attr',
          opId,
          reason,
          target,
          name: candidate.name,
        });
        continue;
      }
      case 'set-text': {
        const target = normalizePatchTarget(candidate.target);
        if (!target || typeof candidate.text !== 'string') {
          continue;
        }

        normalized.push({
          type: 'set-text',
          opId,
          reason,
          target,
          text: candidate.text,
        });
      }
    }
  }

  return normalized;
}

function normalizePatchTarget(target: unknown) {
  if (!target || typeof target !== 'object') {
    return undefined;
  }

  const candidate = target as PartialPatchTarget;
  if (typeof candidate.domId !== 'string' || !candidate.domId.trim()) {
    return undefined;
  }

  return {
    domId: candidate.domId,
    selector: typeof candidate.selector === 'string' && candidate.selector.trim() ? candidate.selector : undefined,
  };
}

function normalizeInsertPosition(value: unknown) {
  return value === 'append' || value === 'prepend' || value === 'before' || value === 'after' ? value : undefined;
}
