import type {
  ChatUIMessage,
  PreparationStageAnnotation,
  RenderableStructuredPageSource,
  UPageBlockAnnotation,
  UPagePagePart,
} from '~/types/message';
import { getCompletedUpageToolPartPages, isUpageToolPart } from '~/utils/message-parts';

export type StructuredPartItem = {
  part: ChatUIMessage['parts'][number];
  index: number;
};

export type StepGroup = {
  startIndex: number;
  parts: StructuredPartItem[];
};

export type PreparationToolPartType =
  | 'tool-historySummary'
  | 'tool-selectRelevantPages'
  | 'tool-buildPageOutlineSnapshot'
  | 'tool-buildPageDetailedSnapshot'
  | 'tool-buildPageSnapshot';

export function buildStepGroups(parts: ChatUIMessage['parts']) {
  const leadingParts: StructuredPartItem[] = [];
  const steps: StepGroup[] = [];
  let currentStep: StepGroup | null = null;

  parts.forEach((part, index) => {
    if (part.type === 'data-summary' || part.type === 'data-preparation-stage') {
      return;
    }

    if (part.type === 'step-start') {
      currentStep = {
        startIndex: index,
        parts: [],
      };
      steps.push(currentStep);
      return;
    }

    const item = { part, index };
    if (currentStep) {
      currentStep.parts.push(item);
      return;
    }

    leadingParts.push(item);
  });

  if (steps.length === 0) {
    return {
      leadingParts,
      steps,
    };
  }

  const [remainingLeadingParts, leadingReasoning] = splitTrailingReasoning(leadingParts);
  steps[0].parts = [...leadingReasoning, ...steps[0].parts];

  for (let index = 1; index < steps.length; index += 1) {
    const previousStep = steps[index - 1];
    const [remainingStepParts, trailingReasoning] = splitTrailingReasoning(previousStep.parts);
    previousStep.parts = remainingStepParts;
    steps[index].parts = [...trailingReasoning, ...steps[index].parts];
  }

  return {
    leadingParts: remainingLeadingParts,
    steps,
  };
}

export function mergeRelatedPageChangeSteps(steps: StepGroup[]) {
  const mergedSteps: StepGroup[] = [];

  for (const step of steps) {
    const previousStep = mergedSteps[mergedSteps.length - 1];

    if (previousStep && shouldMergePageChangeStep(previousStep, step)) {
      previousStep.parts = orderPageChangeStepParts([...previousStep.parts, ...step.parts]);
      continue;
    }

    mergedSteps.push({
      startIndex: step.startIndex,
      parts: [...step.parts],
    });
  }

  return dedupeRepeatedStepText(mergedSteps);
}

export function getRenderableSteps(
  steps: StepGroup[],
  hasPreparationTimeline: boolean,
  timelinePreparationToolTypes: Set<PreparationToolPartType>,
  structuredPageSource: RenderableStructuredPageSource | undefined,
  renderedPageActionKeys: Set<string>,
  blockArtifacts: Map<number, UPagePagePart>,
) {
  return steps.filter((step) => {
    return step.parts.some((item) =>
      isVisibleStructuredPart(
        item,
        hasPreparationTimeline,
        timelinePreparationToolTypes,
        structuredPageSource,
        renderedPageActionKeys,
        blockArtifacts,
      ),
    );
  });
}

export function getPreparationToolTypeByStage(
  stage: PreparationStageAnnotation['stage'],
): PreparationToolPartType | null {
  switch (stage) {
    case 'history-summary':
      return 'tool-historySummary';
    case 'candidate-pages':
      return 'tool-selectRelevantPages';
    case 'page-snapshot':
      return 'tool-buildPageOutlineSnapshot';
    case 'precise-locate':
      return 'tool-buildPageDetailedSnapshot';
    default:
      return null;
  }
}

export function isToolPart(
  part: ChatUIMessage['parts'][number],
): part is Extract<ChatUIMessage['parts'][number], { type: `tool-${string}` }> {
  return part.type.startsWith('tool-');
}

export function isHiddenToolPart(part: Extract<ChatUIMessage['parts'][number], { type: `tool-${string}` }>) {
  return part.type === 'tool-announceUpageBlock';
}

export function shouldHidePreparationToolPart(
  part: Extract<ChatUIMessage['parts'][number], { type: `tool-${string}` }>,
  timelinePreparationToolTypes: Set<PreparationToolPartType>,
) {
  return isPreparationToolPart(part) && timelinePreparationToolTypes.has(part.type);
}

export function isPreparationToolPart(part: Extract<ChatUIMessage['parts'][number], { type: `tool-${string}` }>) {
  return (
    part.type === 'tool-historySummary' ||
    part.type === 'tool-selectRelevantPages' ||
    part.type === 'tool-buildPageOutlineSnapshot' ||
    part.type === 'tool-buildPageDetailedSnapshot' ||
    part.type === 'tool-buildPageSnapshot'
  );
}

export function shouldRenderDesignSystemPreviewFromToolPart(
  part: Extract<ChatUIMessage['parts'][number], { type: 'tool-ensureDesignSystem'; state: 'output-available' }>,
  hasStreamedDesignSystem: boolean,
) {
  return (
    part.type === 'tool-ensureDesignSystem' &&
    part.state === 'output-available' &&
    !hasStreamedDesignSystem &&
    Boolean(part.output.content)
  );
}

export function isEnsureDesignSystemOutputPart(
  part: Extract<ChatUIMessage['parts'][number], { type: `tool-${string}` }>,
): part is Extract<ChatUIMessage['parts'][number], { type: 'tool-ensureDesignSystem'; state: 'output-available' }> {
  return part.type === 'tool-ensureDesignSystem' && part.state === 'output-available';
}

export function getRenderedPageActionKeys(
  parts: ChatUIMessage['parts'],
  structuredPageSource: RenderableStructuredPageSource | undefined,
) {
  const keys = new Set<string>();

  for (const part of parts) {
    if (part.type === 'data-upage-page' && structuredPageSource === 'data-upage-page') {
      part.data.actions.forEach((action) => keys.add(createArtifactActionKey(part.data.artifact.id, action.id)));
      continue;
    }

    if (isUpageToolPart(part) && structuredPageSource === 'tool-upage-output') {
      getCompletedUpageToolPartPages(part).forEach((pagePart) => {
        pagePart.actions.forEach((action) => keys.add(createArtifactActionKey(pagePart.artifact.id, action.id)));
      });
    }
  }

  return keys;
}

export function getRenderableBlockArtifacts(parts: ChatUIMessage['parts'], renderedPageActionKeys: Set<string>) {
  const artifactsById = new Map<
    string,
    {
      firstIndex: number;
      pagePart: UPagePagePart;
      actionKeys: Set<string>;
    }
  >();

  for (const [index, part] of parts.entries()) {
    if (part.type !== 'data-upage-block-start' || isBlockCovered(part.data, renderedPageActionKeys)) {
      continue;
    }

    const artifactId = part.data.artifact.id;
    const actionKey = createArtifactActionKey(artifactId, part.data.action.id);
    const existingArtifact = artifactsById.get(artifactId);

    if (!existingArtifact) {
      artifactsById.set(artifactId, {
        firstIndex: index,
        pagePart: {
          artifact: part.data.artifact,
          actions: [part.data.action],
        },
        actionKeys: new Set([actionKey]),
      });
      continue;
    }

    if (existingArtifact.actionKeys.has(actionKey)) {
      continue;
    }

    existingArtifact.actionKeys.add(actionKey);
    existingArtifact.pagePart.actions.push(part.data.action);
  }

  return new Map(
    [...artifactsById.values()].map((entry) => {
      return [entry.firstIndex, entry.pagePart] as const;
    }),
  );
}

function splitTrailingReasoning(parts: StructuredPartItem[]) {
  let splitIndex = parts.length;

  while (splitIndex > 0) {
    const candidate = parts[splitIndex - 1];
    if (candidate.part.type !== 'reasoning') {
      break;
    }

    splitIndex -= 1;
  }

  return [parts.slice(0, splitIndex), parts.slice(splitIndex)] as const;
}

function shouldMergePageChangeStep(previousStep: StepGroup, currentStep: StepGroup) {
  return (
    previousStep.parts.some((item) => item.part.type === 'data-upage-block-start') &&
    currentStep.parts.some((item) => isUpageToolPart(item.part)) &&
    currentStep.parts.every((item) => isPageChangeContinuationPart(item.part))
  );
}

function isPageChangeContinuationPart(part: ChatUIMessage['parts'][number]) {
  if (part.type === 'data-upage-block-start' || part.type === 'data-upage-block-complete') {
    return true;
  }

  return isToolPart(part) && (part.type === 'tool-upage' || part.type === 'tool-announceUpageBlock');
}

function orderPageChangeStepParts(parts: StructuredPartItem[]) {
  const leadingContent: StructuredPartItem[] = [];
  const toolParts: StructuredPartItem[] = [];
  const blockStarts: StructuredPartItem[] = [];
  const blockCompletes: StructuredPartItem[] = [];

  for (const item of parts) {
    if (item.part.type === 'tool-upage') {
      toolParts.push(item);
      continue;
    }

    if (item.part.type === 'data-upage-block-start') {
      blockStarts.push(item);
      continue;
    }

    if (item.part.type === 'data-upage-block-complete') {
      blockCompletes.push(item);
      continue;
    }

    leadingContent.push(item);
  }

  return [...leadingContent, ...toolParts, ...blockStarts, ...blockCompletes];
}

function dedupeRepeatedStepText(steps: StepGroup[]) {
  let previousTextSignatures = new Set<string>();

  return steps.map((step) => {
    const nextParts = step.parts.filter((item) => {
      if (item.part.type !== 'text') {
        return true;
      }

      const signature = createTextSignature(item.part.text);
      return !signature || !previousTextSignatures.has(signature);
    });

    const currentTextSignatures = new Set(
      nextParts
        .filter(
          (item): item is StructuredPartItem & { part: Extract<StructuredPartItem['part'], { type: 'text' }> } => {
            return item.part.type === 'text';
          },
        )
        .map((item) => createTextSignature(item.part.text))
        .filter((signature): signature is string => Boolean(signature)),
    );

    if (currentTextSignatures.size > 0) {
      previousTextSignatures = currentTextSignatures;
    }

    return {
      ...step,
      parts: nextParts,
    };
  });
}

function createTextSignature(text: string) {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?;:，。！？；：])/g, '$1')
    .trim();
}

function isVisibleStructuredPart(
  item: StructuredPartItem,
  hasPreparationTimeline: boolean,
  timelinePreparationToolTypes: Set<PreparationToolPartType>,
  structuredPageSource: RenderableStructuredPageSource | undefined,
  renderedPageActionKeys: Set<string>,
  blockArtifacts: Map<number, UPagePagePart>,
) {
  const { part } = item;

  if (
    part.type === 'data-summary' ||
    part.type === 'data-preparation-stage' ||
    part.type === 'data-upage-block-complete'
  ) {
    return false;
  }

  if (part.type === 'data-upage-page') {
    return structuredPageSource === 'data-upage-page';
  }

  if (part.type === 'data-upage-block-start') {
    return blockArtifacts.has(item.index);
  }

  if (isToolPart(part)) {
    if (isHiddenToolPart(part)) {
      return false;
    }

    if (hasPreparationTimeline && shouldHidePreparationToolPart(part, timelinePreparationToolTypes)) {
      return false;
    }

    if (isUpageToolPart(part)) {
      return true;
    }
  }

  return true;
}

function isBlockCovered(block: UPageBlockAnnotation, renderedPageActionKeys: Set<string>) {
  return renderedPageActionKeys.has(createArtifactActionKey(block.artifact.id, block.action.id));
}

function createArtifactActionKey(artifactId: string, actionId: string) {
  return `${artifactId}:${actionId}`;
}
