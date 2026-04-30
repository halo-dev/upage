import type { UIMessage } from 'ai';
import type { PatchOp, UPageAction, UPageActionType } from './actions';
import type { UPageArtifactData } from './artifact';
import type { PageBuilderUITools, UPagePagePart } from './page-builder-tools';
import type { PageData } from './pages';

export type AgentRunStatus = 'running' | 'completed' | 'failed' | 'aborted';
export type GuardrailStopReason =
  | 'finished_by_agent'
  | 'no_effective_progress'
  | 'duplicate_action'
  | 'step_budget_exceeded';
export type AgentErrorPhase =
  | 'summary_failed'
  | 'context_failed'
  | 'design_system_failed'
  | 'agent_loop_failed'
  | 'tool_upage_failed'
  | 'guardrail_stopped'
  | 'persist_failed';
export type UPageProtocolVersion = 'legacy-xml' | 'structured-parts-v2';

export type ElementInfoMetadata = {
  tagName: string;
  className?: string;
  id?: string;
  domId?: string;
  innerHTML?: string;
  outerHTML?: string;
};

export type UPageMessageMetadata = {
  isHidden?: boolean;
  elementInfo?: ElementInfoMetadata;
  protocolVersion?: UPageProtocolVersion;
  runStatus?: AgentRunStatus;
  runMode?: 'agent-runtime-v1';
  finishReason?: string;
  stepCount?: number;
  errorPhase?: AgentErrorPhase;
  lastEffectiveTool?: string;
  invalidStepCount?: number;
  effectiveMutationCount?: number;
  guardrailStopReason?: GuardrailStopReason;
};

export type ChatRequestPhase = 'idle' | 'submitted' | 'streaming';

export type ProgressAnnotation = {
  label: string;
  status: 'in-progress' | 'complete' | 'stopped' | 'warning';
  order: number;
  message: string;
};

export type SummaryAnnotation = {
  chatId: string;
  summary: string;
};

export type DesignMdAnnotation = {
  content: string;
};

export type PreparationStage =
  | 'history-summary'
  | 'candidate-pages'
  | 'page-snapshot'
  | 'precise-locate'
  | 'design-system';

export type PreparationStageStatus = 'in-progress' | 'complete' | 'warning' | 'failed' | 'skipped';

export type PreparationStageAnnotation = {
  stage: PreparationStage;
  status: PreparationStageStatus;
  order: number;
  label: string;
  message: string;
  detail?: string;
  durationMs?: number;
  selectedPages?: string[];
  warning?: string;
};

export type UPageBlockAnnotation = {
  artifact: UPageArtifactData;
  action: UPageAction;
  sequence: number;
};

export type UserPageSnapshotPage = Pick<
  PageData,
  | 'id'
  | 'name'
  | 'title'
  | 'content'
  | 'actionIds'
  | 'headMeta'
  | 'headLinks'
  | 'headScripts'
  | 'headStyles'
  | 'headRaw'
  | 'sort'
>;

export type UserPageSnapshot = {
  pages: UserPageSnapshotPage[];
  actions: UPageAction[];
};

export type UPageDataParts = {
  progress: ProgressAnnotation;
  summary: SummaryAnnotation;
  'design-md': DesignMdAnnotation;
  'preparation-stage': PreparationStageAnnotation;
  'upage-page': UPagePagePart;
  'upage-block-start': UPageBlockAnnotation;
  'upage-block-complete': UPageBlockAnnotation;
};

export type ChatUIMessage = UIMessage<UPageMessageMetadata, UPageDataParts, PageBuilderUITools>;
export type StructuredPageSource = 'tool-upage-output' | 'tool-upage-input' | 'data-upage-page';
export type RenderableStructuredPageSource = Exclude<StructuredPageSource, 'tool-upage-input'>;

export type PartialPatchTarget = {
  domId?: unknown;
  selector?: unknown;
};

export type PartialPatchOp = {
  opId?: unknown;
  reason?: unknown;
  type?: unknown;
  target?: PartialPatchTarget;
  parentDomId?: unknown;
  html?: unknown;
  position?: unknown;
  relativeToDomId?: unknown;
  sort?: unknown;
  name?: unknown;
  value?: unknown;
  text?: unknown;
};

export type { PatchOp, UPageAction, UPageActionType };
