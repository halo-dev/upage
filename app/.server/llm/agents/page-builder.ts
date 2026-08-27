import {
  hasToolCall,
  type ModelMessage,
  type PrepareStepFunction,
  stepCountIs,
  Experimental_Agent as ToolLoopAgent,
} from 'ai';
import { DEFAULT_MODEL, DEFAULT_MODEL_DETAILS, getModel } from '~/.server/modules/constants';
import { getPageV2ByMessageId } from '~/.server/service/page-v2';
import type { SectionCreateParams } from '~/.server/service/section';
import type { ElementInfo } from '~/routes/api/chat/chat';
import type { ChatMetadata } from '~/types/chat';
import type {
  AgentErrorPhase,
  ChatUIMessage,
  PreparationStage,
  PreparationStageAnnotation,
  UPageBlockAnnotation,
  UPagePagePart,
  UserPageSnapshot,
} from '~/types/message';
import type { PageData } from '~/types/pages';
import { buildContextFromPages, resolveSelectedPages } from '../preparation';
import { type SelectContextResult } from '../select-context';
import type { StreamTextUIEvent } from '../ui-message-stream';
import { hasUserImageParts } from '../utils';
import { mergePageSnapshotPages, resolvePageContextMessage } from './page-builder-context';
import {
  applyPagePartToDraftProjectSnapshot,
  createDraftProjectSnapshot,
  type DraftProjectSnapshot,
  serializeDraftProjectSnapshot,
} from './page-builder-draft';
import { createPageBuilderTools, type PageBuilderToolName, type PageBuilderTools } from './page-builder-tools';
import { buildPageGenerationSystemPrompt, PAGE_GENERATION_STEP_LIMIT } from './page-generation';

type PageBuilderAgentParams = {
  request: Request;
  chatId: string;
  chatMetadata: ChatMetadata | null;
  previousMessages: ChatUIMessage[];
  currentMessage: ChatUIMessage;
  persistedDesignMd: string;
  clientDesignMd?: string;
  pageSnapshot?: UserPageSnapshot;
  userPageContext?: string;
  elementInfo?: ElementInfo;
  onFinish?: PageBuilderOnFinish;
  onMinorModelUsage?: (usage: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    reasoningTokens?: number;
    cachedInputTokens?: number;
  }) => void;
  onDesignSystemStreamEvent?: (event: StreamTextUIEvent) => void;
  onUpageBlockStart?: (block: UPageBlockAnnotation) => void;
  onPreparationStage?: (event: PreparationStageAnnotation) => void;
  onDraftCheckpoint?: (project: { pages: PageData[]; sections: SectionCreateParams[] }) => Promise<void> | void;
};

const MAX_INVALID_STEP_COUNT = 2;

export type PageBuilderAgentState = {
  summary: string;
  context: Record<string, SelectContextResult>;
  pageSummaryOutline: string;
  pageSummaryDetailed: string;
  designMd: string;
  visualSummary: string;
  rawPages: PageData[];
  selectedPages: PageData[];
  pagesLoaded: boolean;
  summaryReady: boolean;
  contextReady: boolean;
  snapshotReady: boolean;
  snapshotPhase: 'none' | 'outline' | 'detailed';
  designReady: boolean;
  visualSummaryReady: boolean;
  hasVisualReference: boolean;
  visualMode: 'direct' | 'sidecar' | 'limited' | 'none';
  preparationWarnings: string[];
  candidatePages: string[];
  preparationDurationMs?: number;
  emittedPages: UPagePagePart[];
  lastEffectiveTool?: string;
  invalidStepCount: number;
  preparedStepCount: number;
  effectiveMutationCount: number;
  hasRejectedPageMutation: boolean;
  guardrailStopReason?: 'finished_by_agent' | 'no_effective_progress' | 'duplicate_action' | 'step_budget_exceeded';
  finishRequested: boolean;
  errorPhase?: AgentErrorPhase;
  lastPreparedStep?: {
    system?: string;
    messages: unknown[];
  };
  draftSnapshot?: DraftProjectSnapshot;
};

type PageBuilderFinishEvent = {
  totalUsage: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    reasoningTokens?: number;
    cachedInputTokens?: number;
  };
  finishReason?: string;
  steps: unknown[];
};

type PageBuilderOnFinish = (event: PageBuilderFinishEvent) => PromiseLike<void> | void;

export function createPageBuilderAgent({
  request,
  chatId,
  chatMetadata,
  previousMessages,
  currentMessage,
  persistedDesignMd,
  clientDesignMd,
  pageSnapshot,
  userPageContext,
  elementInfo,
  onFinish,
  onMinorModelUsage,
  onDesignSystemStreamEvent,
  onUpageBlockStart,
  onPreparationStage,
  onDraftCheckpoint,
}: PageBuilderAgentParams) {
  const state: PageBuilderAgentState = {
    summary: '',
    context: {},
    pageSummaryOutline: '',
    pageSummaryDetailed: '',
    designMd: clientDesignMd || persistedDesignMd,
    visualSummary: '',
    rawPages: [],
    selectedPages: [],
    pagesLoaded: false,
    summaryReady: false,
    contextReady: false,
    snapshotReady: false,
    snapshotPhase: 'none',
    designReady: Boolean(clientDesignMd || persistedDesignMd),
    visualSummaryReady: false,
    hasVisualReference: hasUserImageParts(currentMessage),
    visualMode: 'none',
    preparationWarnings: [],
    candidatePages: [],
    emittedPages: [],
    invalidStepCount: 0,
    preparedStepCount: 0,
    effectiveMutationCount: 0,
    hasRejectedPageMutation: false,
    finishRequested: false,
  };
  const announcedBlockKeys = new Set<string>();
  const submittedActionKeys = new Set<string>();
  const preparationStageStartedAt = new Map<PreparationStage, number>();
  const preparationStageOrder = new Map<PreparationStage, number>();
  let nextPreparationStageOrder = 1;

  const emitPreparationStage = ({
    stage,
    status,
    message,
    detail,
    selectedPages,
    warning,
  }: Omit<PreparationStageAnnotation, 'order' | 'label'>) => {
    const now = Date.now();
    if (status === 'in-progress' && !preparationStageStartedAt.has(stage)) {
      preparationStageStartedAt.set(stage, now);
    }

    const startedAt = preparationStageStartedAt.get(stage);
    const durationMs = status === 'in-progress' || startedAt === undefined ? undefined : now - startedAt;
    if (!preparationStageOrder.has(stage)) {
      preparationStageOrder.set(stage, nextPreparationStageOrder++);
    }
    const order = preparationStageOrder.get(stage) ?? nextPreparationStageOrder++;
    onPreparationStage?.({
      stage,
      status,
      order,
      label: getPreparationStageLabel(stage),
      message,
      detail,
      durationMs,
      selectedPages,
      warning,
    });
  };

  const createPreparationReasoningForwarder = (stage: PreparationStage, message: string) => {
    let reasoning = '';

    return (event: StreamTextUIEvent) => {
      if (event.chunk.type === 'reasoning-start') {
        reasoning = '';
        emitPreparationStage({
          stage,
          status: 'in-progress',
          message,
          detail: '正在思考...',
        });
        return;
      }

      if (event.chunk.type === 'reasoning-delta') {
        reasoning += event.chunk.delta;
        emitPreparationStage({
          stage,
          status: 'in-progress',
          message,
          detail: reasoning,
        });
        return;
      }

      if (event.chunk.type === 'reasoning-end' && reasoning) {
        emitPreparationStage({
          stage,
          status: 'in-progress',
          message,
          detail: reasoning,
        });
      }
    };
  };

  const markEffectiveTool = (toolName: string) => {
    state.lastEffectiveTool = toolName;
    state.invalidStepCount = 0;
  };

  const markInvalidToolCall = (
    toolName: PageBuilderToolName,
    reason: string,
    stopReason: PageBuilderAgentState['guardrailStopReason'] = 'no_effective_progress',
  ) => {
    state.invalidStepCount += 1;
    state.preparationWarnings.push(`${toolName} 未产生有效进展：${reason}`);

    if (!state.guardrailStopReason && state.invalidStepCount >= MAX_INVALID_STEP_COUNT) {
      state.guardrailStopReason = stopReason;
    }
  };

  const ensureRawPagesLoaded = async () => {
    if (state.pagesLoaded) {
      return state.rawPages;
    }

    const baselineMessage = resolvePageContextMessage(previousMessages);
    let persistedPages: PageData[] = [];

    if (baselineMessage) {
      try {
        persistedPages = (await getPageV2ByMessageId(baselineMessage.id)) as unknown as PageData[];
      } catch (error) {
        const warning = error instanceof Error ? error.message : '历史页面读取失败';
        state.preparationWarnings.push(`历史页面读取失败，已跳过页面相关准备：${warning}`);
      }
    }

    state.rawPages = mergePageSnapshotPages(persistedPages, pageSnapshot, baselineMessage?.id);
    state.pagesLoaded = true;
    return state.rawPages;
  };

  const ensureSelectedPages = async (allowFallback: boolean) => {
    if (state.selectedPages.length > 0) {
      return state.selectedPages;
    }

    const rawPages = await ensureRawPagesLoaded();
    if (rawPages.length === 0) {
      return [];
    }

    if (allowFallback) {
      state.selectedPages = resolveSelectedPages(rawPages, state.candidatePages);
      state.candidatePages = state.selectedPages.map((page) => page.name);
      state.context = buildContextFromPages(state.selectedPages);
      state.contextReady = true;
    }

    return state.selectedPages;
  };

  const ensureDraftSnapshotLoaded = async () => {
    if (state.draftSnapshot) {
      return state.draftSnapshot;
    }

    const rawPages = await ensureRawPagesLoaded();
    const baselineMessage = resolvePageContextMessage(previousMessages);
    state.draftSnapshot = await createDraftProjectSnapshot({
      anchorMessageId: currentMessage.id,
      pages: rawPages,
      baselineMessageId: baselineMessage?.id,
      pageSnapshot,
    });
    return state.draftSnapshot;
  };

  const persistDraftCheckpoint = async (page: UPagePagePart) => {
    if (!onDraftCheckpoint) {
      return;
    }

    const draftSnapshot = await ensureDraftSnapshotLoaded();
    applyPagePartToDraftProjectSnapshot(draftSnapshot, page);
    const serialized = serializeDraftProjectSnapshot(draftSnapshot);
    state.rawPages = serialized.pages;
    await onDraftCheckpoint(serialized);
  };

  const tools = createPageBuilderTools({
    request,
    chatId,
    chatMetadata,
    previousMessages,
    currentMessage,
    state,
    clientDesignMd,
    onMinorModelUsage,
    onDesignSystemStreamEvent,
    onUpageBlockStart,
    emitPreparationStage,
    createPreparationReasoningForwarder,
    markEffectiveTool,
    markInvalidToolCall,
    ensureRawPagesLoaded,
    ensureSelectedPages,
    onDraftCheckpoint: persistDraftCheckpoint,
    announcedBlockKeys,
    submittedActionKeys,
  });

  type PageBuilderPrepareStep = PrepareStepFunction<PageBuilderTools>;

  const prepareStep: PageBuilderPrepareStep = async ({ messages }) => {
    if (state.guardrailStopReason === 'step_budget_exceeded' || state.invalidStepCount >= MAX_INVALID_STEP_COUNT) {
      const preparedMessages = trimMessages(messages);
      const preparedSystem = `你已经触发运行时 guardrail，需要立即结束本轮工具调用并只输出一段简短总结。

停止原因：${state.guardrailStopReason || 'no_effective_progress'}
已完成页面变更次数：${state.effectiveMutationCount}
累计无效步骤：${state.invalidStepCount}

不要继续调用任何工具，不要输出代码，只说明已经完成的结果、降级情况和后续建议。
默认使用用户最新消息的语言；如果用户明确指定了输出语言，则按用户指定的语言回答。
必须使用普通用户能看懂的表达，避免 HTML/CSS/属性名/页面内部标识/action id 之类的技术细节。`;
      state.lastPreparedStep = {
        system: preparedSystem,
        messages: preparedMessages,
      };
      state.preparedStepCount += 1;
      return {
        toolChoice: 'none',
        system: preparedSystem,
        messages: preparedMessages,
      };
    }

    if (state.finishRequested) {
      const preparedMessages = trimMessages(messages);
      const preparedSystem = `你已经调用 finishRun，下一步只允许输出一段简短总结。

要求：
1. 不要再调用任何工具。
2. 用普通用户能看懂的话说明本次改了什么、用户会看到什么变化，不要重复前一步已经说过的同一句话。
3. 默认使用用户最新消息的语言；如果用户明确指定了输出语言，则按用户指定的语言回答。
4. 若本轮没有实际页面变更，也要明确说明原因。`;
      state.lastPreparedStep = {
        system: preparedSystem,
        messages: preparedMessages,
      };
      state.preparedStepCount += 1;
      return {
        toolChoice: 'none',
        system: preparedSystem,
        messages: preparedMessages,
      };
    }

    const preparedMessages = trimMessages(messages);
    const preparedSystem = `${buildPageGenerationSystemPrompt({
      summary: state.summary,
      pageSummaryOutline: state.pageSummaryOutline,
      pageSummaryDetailed: state.pageSummaryDetailed,
      context: state.context,
      designMd: state.designMd || '当前暂无 DESIGN.md；如需统一视觉规范，可按需调用 ensureDesignSystem。',
      visualSummary: state.visualSummary,
      userPageContext,
      elementInfo,
    })}

你处于受限页面生成 agent 模式，当前运行时状态如下：
- 历史摘要：${state.summaryReady ? '已就绪' : '未就绪'}
- 页面筛选：${state.contextReady ? `已就绪（${state.candidatePages.join('、') || '无页面'}）` : '未就绪'}
- 页面概览：${state.snapshotReady ? '已就绪' : '未就绪'}
- 精确定位：${state.snapshotPhase === 'detailed' ? '已就绪' : '未就绪'}
- 设计系统：${state.designReady ? '已就绪' : '未就绪'}
- 已提交页面变更：${state.effectiveMutationCount}
- 当前无效步骤：${state.invalidStepCount}

执行规则：
1. historySummary、selectRelevantPages、buildPageOutlineSnapshot、buildPageDetailedSnapshot、ensureDesignSystem 都是可按需调用的信息工具，不代表固定阶段；只有在它们能帮助你完成当前请求时才调用。
2. 如果需要创建、更新或删除页面，必须先调用 announceUpageBlock，再调用 upage。
3. 如需统一视觉风格但当前没有足够规范，可调用 ensureDesignSystem；如果已有足够上下文，不必为了“走流程”而额外调用准备工具。
4. 不要重复提交已经用过的 actionId；重复或空提交会触发 guardrail。
5. 每批 announceUpageBlock 与紧随其后的 upage 必须使用同一组 artifact/action 标识符，单批最多 3 个区块。
6. 不要在正文直接输出完整 HTML、CSS、JS、代码块或页面协议；即使已经想好完整页面，也必须拆成 upage 调用后再提交。
7. 上一轮消息中的 finishRun 只代表上一轮结束，不会限制本轮；不要把历史里的 finishRun 当成“本轮不能继续编辑”的理由。
8. 如果你只是想快速理解页面结构，优先调用 buildPageOutlineSnapshot。
9. 只有当你还需要更强的修改定位信息时，再调用 buildPageDetailedSnapshot。
10. 你必须在内部先判断：这轮请求究竟是“必须产生实际页面变更”还是“只需要说明/分析/解释”。
11. 调用 finishRun 时，必须通过 requiresMutation 字段显式写出你的内部判断结果；如果只是说明信息不足、缺少视觉参考或暂时无法继续，请传 requiresMutation=false。
12. 如果你判断这轮请求必须产生实际页面变更，那么在至少一次成功的 upage 提交前，不要调用 finishRun。
13. 只有当你已经完成本轮页面提交或说明任务时，才可以调用 finishRun 结束工具阶段。
14. 当用户要求从零创建项目或页面、已经进入规划阶段，但没有明确给出视觉风格时，必须先调用 requestUserChoice，提供 3-4 个针对当前项目、彼此有明显差异的风格方向，并允许用户自定义输入；在用户回答前，不得调用 ensureDesignSystem、announceUpageBlock 或 upage。
15. 如果用户已经在当前消息、设计系统或视觉参考中明确表达了风格，不要重复询问同一个决定，直接继续后续步骤。
16. 除了初始风格，在后续 Agent 执行中遇到会显著影响结果、且存在多种合理取舍的决策时，也可以调用 requestUserChoice。每轮最多询问一次；不要为琐碎细节打断用户，也不要要求用户确认技术性的中间对象。
17. requestUserChoice 一旦调用，本轮运行会自动暂停。不要同时提交其他工具调用；等待用户选择或输入自定义方案后，在下一轮基于答案继续。`;
    state.lastPreparedStep = {
      system: preparedSystem,
      messages: preparedMessages,
    };
    state.preparedStepCount += 1;
    return {
      activeTools: getPageBuilderActiveTools(),
      system: preparedSystem,
      messages: preparedMessages,
    };
  };

  const agent = new ToolLoopAgent({
    model: getModel(DEFAULT_MODEL),
    maxOutputTokens: DEFAULT_MODEL_DETAILS?.maxTokenAllowed,
    stopWhen: [stepCountIs(PAGE_GENERATION_STEP_LIMIT), hasToolCall('requestUserChoice')],
    tools,
    prepareStep,
    onFinish,
  });

  return {
    agent,
    state,
  };
}

function getPreparationStageLabel(stage: PreparationStage) {
  switch (stage) {
    case 'history-summary':
      return '历史摘要';
    case 'candidate-pages':
      return '相关页面筛选';
    case 'page-snapshot':
      return '页面快照';
    case 'precise-locate':
      return '精确定位';
    case 'design-system':
      return '设计系统';
    default:
      return stage;
  }
}

function trimMessages(messages: ModelMessage[]) {
  if (messages.length > 20) {
    return messages.slice(-10);
  }

  return messages;
}

export function getPageBuilderActiveTools(): Array<keyof PageBuilderTools> {
  const tools: Array<keyof PageBuilderTools> = [
    'historySummary',
    'selectRelevantPages',
    'buildPageOutlineSnapshot',
    'buildPageDetailedSnapshot',
    'ensureDesignSystem',
    'requestUserChoice',
    'announceUpageBlock',
    'upage',
    'finishRun',
    ...(process.env.SERPER_API_KEY ? (['serper'] as const) : []),
    ...(process.env.WEATHER_API_KEY ? (['weather'] as const) : []),
  ];

  return tools;
}
