import { Fragment, memo } from 'react';
import { Artifact } from '~/.client/components/chat/Artifact';
import Popover from '~/.client/components/ui/Popover';
import Tooltip from '~/.client/components/ui/Tooltip';
import {
  type ChatUIMessage,
  type PreparationStageAnnotation,
  type RenderableStructuredPageSource,
  type UPagePagePart,
} from '~/types/message';
import {
  getCompletedUpageToolPartPages,
  getStructuredPageSource,
  hasStructuredPageParts,
  hasUpageBlockParts,
  isUpageToolPart,
} from '~/utils/message-parts';
import {
  buildStepGroups,
  getPreparationToolTypeByStage,
  getRenderableBlockArtifacts,
  getRenderableSteps,
  getRenderedPageActionKeys,
  isEnsureDesignSystemOutputPart,
  isHiddenToolPart,
  isPreparationToolPart,
  isToolPart,
  mergeRelatedPageChangeSteps,
  type PreparationToolPartType,
  type StepGroup,
  type StructuredPartItem,
  shouldHidePreparationToolPart,
  shouldRenderDesignSystemPreviewFromToolPart,
} from './assistant-message-structure';
import { DesignSystemPreview } from './DesignSystemPreview';
import { Markdown } from './Markdown';
import markdownStyles from './Markdown.module.scss';
import { PreparationTimeline } from './PreparationTimeline';
import { RunningStatus } from './RunningStatus';
import ThoughtBox from './ThoughtBox';
import { ToolInvocationCard } from './ToolInvocationCard';

export const AssistantMessage = memo(
  ({
    message,
    renderedText,
    isStreaming = false,
    isAborted = false,
  }: {
    message: ChatUIMessage;
    renderedText?: string;
    isStreaming?: boolean;
    isAborted?: boolean;
  }) => {
    const isStructuredMessage =
      hasStructuredPageParts(message) ||
      hasUpageBlockParts(message) ||
      (message.parts || []).some(
        (part) =>
          part.type === 'reasoning' ||
          part.type === 'step-start' ||
          part.type === 'data-design-md' ||
          part.type === 'data-preparation-stage' ||
          part.type === 'data-upage-block-start' ||
          part.type.startsWith('tool-'),
      );

    const summaryParts = (message.parts || []).filter((part) => part.type === 'data-summary');

    return (
      <div className="overflow-hidden w-full flex flex-col gap-3">
        {summaryParts.map((part, index) => {
          return (
            <div key={`summary-${index}`} className="flex gap-2 items-center text-sm text-upage-elements-textSecondary">
              {part.data.summary && (
                <Tooltip tooltip="查看对话上下文" position="top">
                  <div className="relative group">
                    <Popover
                      side="right"
                      align="start"
                      trigger={
                        <button
                          aria-label="Open context"
                          className="i-ph:clipboard-text text-lg text-upage-elements-textSecondary cursor-pointer transition-all duration-200 ease-out"
                        />
                      }
                    >
                      {part.data.summary && (
                        <div className="max-w-chat">
                          <div className="summary flex flex-col">
                            <div className="p-5 border border-upage-elements-borderColor rounded-md bg-upage-elements-background shadow-sm">
                              <h2 className="text-lg font-medium text-upage-elements-textPrimary border-b border-upage-elements-borderColor pb-3 mb-4 flex items-center gap-2">
                                <span className="i-ph:note-pencil"></span>
                                摘要
                              </h2>
                              <div className="overflow-y-auto max-h-80 text-sm">
                                <Markdown>{part.data.summary}</Markdown>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="context"></div>
                    </Popover>
                  </div>
                </Tooltip>
              )}
            </div>
          );
        })}
        {isStructuredMessage ? (
          <div className="flex flex-col gap-3">
            <StructuredMessageContent message={message} isStreaming={isStreaming} isAborted={isAborted} />
          </div>
        ) : (
          renderedText && (
            <div className="px-0.5">
              <Markdown html>{renderedText}</Markdown>
            </div>
          )
        )}
      </div>
    );
  },
);

function StructuredMessageContent({
  message,
  isStreaming,
  isAborted,
}: {
  message: ChatUIMessage;
  isStreaming: boolean;
  isAborted: boolean;
}) {
  const messageParts = message.parts || [];
  const hasStreamedDesignSystem = messageParts.some((part) => part.type === 'data-design-md');
  const structuredPageSource = getStructuredPageSource(message);
  const renderedPageActionKeys = getRenderedPageActionKeys(messageParts, structuredPageSource);
  const blockArtifacts = getRenderableBlockArtifacts(messageParts, renderedPageActionKeys);
  const hasPreparationToolParts = messageParts.some((part) => isToolPart(part) && isPreparationToolPart(part));
  const preparationParts = messageParts
    .filter(
      (part): part is Extract<(typeof messageParts)[number], { type: 'data-preparation-stage' }> =>
        part.type === 'data-preparation-stage' && part.data.stage !== 'design-system',
    )
    .map((part) => part.data as PreparationStageAnnotation);
  const timelinePreparationToolTypes = new Set(
    preparationParts
      .map((part) => getPreparationToolTypeByStage(part.stage))
      .filter((toolType): toolType is PreparationToolPartType => toolType !== null),
  );
  const { leadingParts, steps: rawSteps } = buildStepGroups(messageParts);
  const steps = mergeRelatedPageChangeSteps(rawSteps);
  const hasPreparationTimeline = timelinePreparationToolTypes.size > 0 && hasPreparationToolParts;
  const visibleSteps = getRenderableSteps(
    steps,
    hasPreparationTimeline,
    timelinePreparationToolTypes,
    structuredPageSource,
    renderedPageActionKeys,
    blockArtifacts,
  );
  const activeReasoningIndex = getActiveReasoningIndex(leadingParts, visibleSteps, isStreaming);
  const activeStep = isStreaming && visibleSteps.length > 0 ? visibleSteps[visibleSteps.length - 1] : null;
  const hasRunningActiveStep = activeStep ? hasRunningStepPart(activeStep, activeReasoningIndex) : false;
  const activeStepIndex = hasRunningActiveStep ? (activeStep?.startIndex ?? -1) : -1;

  return (
    <>
      {hasPreparationTimeline ? <PreparationTimeline parts={preparationParts} isStreaming={isStreaming} /> : null}
      {leadingParts.map((item) =>
        renderStructuredPart({
          item,
          message,
          isStreaming,
          isAborted,
          insideStep: false,
          hasPreparationTimeline,
          timelinePreparationToolTypes,
          hasStreamedDesignSystem,
          structuredPageSource,
          renderedPageActionKeys,
          blockArtifacts,
          activeReasoningIndex,
        }),
      )}
      {visibleSteps.map((step, stepIndex) => (
        <div
          key={`step-group-${step.startIndex}`}
          data-testid={`step-container-${stepIndex + 1}`}
          className="flex flex-col gap-2 px-0.5"
        >
          <div className="flex items-center gap-1.5 text-[10px] text-upage-elements-textSecondary/85">
            <span>步骤 {stepIndex + 1}</span>
            {step.startIndex === activeStepIndex ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-upage-elements-background/85 px-1.5 py-0.5 text-[9px] text-upage-elements-textSecondary">
                <RunningStatus label="步骤执行中" iconClassName="text-[11px]" />
                <span>执行中</span>
              </span>
            ) : null}
          </div>
          {step.parts.map((item) => (
            <Fragment key={`step-part-${item.index}`}>
              {shouldRenderPendingPageChangeStatus(step, item, isStreaming) ? <PendingPageChangeStatusCard /> : null}
              {renderStructuredPart({
                item,
                message,
                isStreaming,
                isAborted,
                insideStep: true,
                hasPreparationTimeline,
                timelinePreparationToolTypes,
                hasStreamedDesignSystem,
                structuredPageSource,
                renderedPageActionKeys,
                blockArtifacts,
                activeReasoningIndex,
              })}
            </Fragment>
          ))}
        </div>
      ))}
    </>
  );
}

function getActiveReasoningIndex(leadingParts: StructuredPartItem[], steps: StepGroup[], isStreaming: boolean) {
  if (!isStreaming) {
    return -1;
  }

  const orderedParts = [...leadingParts, ...steps.flatMap((step) => step.parts)];

  for (let index = orderedParts.length - 1; index >= 0; index -= 1) {
    const item = orderedParts[index];

    if (item.part.type === 'data-summary') {
      continue;
    }

    return item.part.type === 'reasoning' ? item.index : -1;
  }

  return -1;
}

function hasRunningStepPart(step: StepGroup, activeReasoningIndex: number) {
  return step.parts.some((item) => {
    if (item.part.type === 'reasoning') {
      return item.index === activeReasoningIndex;
    }

    return isToolPart(item.part) && (item.part.state === 'input-streaming' || item.part.state === 'input-available');
  });
}

function shouldRenderPendingPageChangeStatus(step: StepGroup, item: StructuredPartItem, isStreaming: boolean) {
  if (!isStreaming) {
    return false;
  }

  if (step.parts.some((candidate) => candidate.part.type === 'tool-upage')) {
    return false;
  }

  const firstBlockStart = step.parts.find((candidate) => candidate.part.type === 'data-upage-block-start');
  return firstBlockStart?.index === item.index;
}

function PendingPageChangeStatusCard() {
  return (
    <div className="rounded-md border border-upage-elements-borderColor/50 bg-upage-elements-background-depth-1/20 px-2.5 py-2">
      <div className="flex items-start justify-between gap-2.5 text-sm">
        <div className="flex min-w-0 items-start gap-2">
          <div className="mt-0.5 flex size-5.5 shrink-0 items-center justify-center rounded-full bg-upage-elements-background/85">
            <RunningStatus label="准备应用页面变更" iconClassName="text-sm" />
          </div>
          <span className="text-[12px] font-medium leading-5 text-upage-elements-textPrimary">准备应用页面变更</span>
        </div>
        <RunningStatus
          label="准备应用页面变更"
          className="mt-0.5 shrink-0 rounded-full bg-upage-elements-background/85 px-1.5 py-0.5"
          iconClassName="text-sm"
        />
      </div>
      <div className="mt-1 pl-7 text-[12px] leading-[1.45] text-upage-elements-textSecondary whitespace-pre-wrap">
        已接收到页面区块，正在整理完整的页面变更指令。
      </div>
    </div>
  );
}

function renderStructuredPart({
  item,
  message,
  isStreaming,
  isAborted,
  insideStep,
  hasPreparationTimeline,
  timelinePreparationToolTypes,
  hasStreamedDesignSystem,
  structuredPageSource,
  renderedPageActionKeys,
  blockArtifacts,
  activeReasoningIndex,
}: {
  item: StructuredPartItem;
  message: ChatUIMessage;
  isStreaming: boolean;
  isAborted: boolean;
  insideStep: boolean;
  hasPreparationTimeline: boolean;
  timelinePreparationToolTypes: Set<PreparationToolPartType>;
  hasStreamedDesignSystem: boolean;
  structuredPageSource: RenderableStructuredPageSource | undefined;
  renderedPageActionKeys: Set<string>;
  blockArtifacts: Map<number, UPagePagePart>;
  activeReasoningIndex: number;
}) {
  const { part, index } = item;

  if (part.type === 'text') {
    return (
      <div key={`text-${index}`} className={insideStep ? 'px-0.5 pt-0.5' : undefined}>
        <Markdown html className={insideStep ? markdownStyles.StepBody : undefined}>
          {part.text}
        </Markdown>
      </div>
    );
  }

  if (part.type === 'reasoning') {
    return (
      <ThoughtBox key={`reasoning-${index}`} title="思考过程" isRunning={index === activeReasoningIndex}>
        <Markdown>{part.text}</Markdown>
      </ThoughtBox>
    );
  }

  if (part.type === 'data-design-md') {
    return <DesignSystemPreview key={`design-md-${index}`} content={part.data.content} isStreaming={isStreaming} />;
  }

  if (part.type === 'data-preparation-stage') {
    return null;
  }

  if (part.type === 'data-upage-page') {
    if (structuredPageSource !== 'data-upage-page') {
      return null;
    }

    return renderPageArtifacts([part.data], message.id, index);
  }

  if (part.type === 'data-upage-block-start') {
    const blockArtifact = blockArtifacts.get(index);
    if (!blockArtifact) {
      return null;
    }

    return renderPageArtifacts([blockArtifact], message.id, index);
  }

  if (part.type === 'data-upage-block-complete') {
    return null;
  }

  if (isToolPart(part)) {
    if (isHiddenToolPart(part)) {
      return null;
    }

    if (hasPreparationTimeline && shouldHidePreparationToolPart(part, timelinePreparationToolTypes)) {
      return null;
    }

    const pageParts =
      isUpageToolPart(part) && structuredPageSource === 'tool-upage-output' ? getCompletedUpageToolPartPages(part) : [];
    const designSystemPreview =
      isEnsureDesignSystemOutputPart(part) &&
      shouldRenderDesignSystemPreviewFromToolPart(part, hasStreamedDesignSystem) ? (
        <DesignSystemPreview content={part.output.content} />
      ) : null;

    return (
      <div key={`tool-${index}`} className="flex flex-col gap-2">
        <ToolInvocationCard part={part} runStatus={isAborted ? 'aborted' : message.metadata?.runStatus} />
        {designSystemPreview}
        {pageParts.length > 0 ? renderPageArtifacts(pageParts, message.id, index) : null}
      </div>
    );
  }

  return null;
}

function renderPageArtifacts(pageParts: UPagePagePart[], messageId: string, index: number) {
  return (
    <div key={`page-group-${index}`} className="flex flex-col gap-3">
      {pageParts.map((pagePart, pageIndex) => (
        <Artifact
          key={`page-${pagePart.artifact.id}-${pageIndex}`}
          messageId={messageId}
          artifactId={pagePart.artifact.id}
          actionIds={pagePart.actions.map((action) => action.id)}
        />
      ))}
    </div>
  );
}
