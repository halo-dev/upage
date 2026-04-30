import { tool } from 'ai';
import { z } from 'zod';
import { getUserMessageContent, hasUserImageParts } from '~/.server/llm/utils';
import {
  DEFAULT_MODEL,
  DEFAULT_PROVIDER,
  getLanguageModelByProvider,
  getModel,
  getProviderByName,
  MINOR_MODEL,
  VISION_MODEL,
  VISION_PROVIDER_NAME,
} from '~/.server/modules/constants';
import { getModelCapabilities } from '~/.server/modules/llm/capabilities';
import { updateChat } from '~/.server/service/chat';
import { materializeMessageFileReferencesForModel } from '~/.server/service/chat-file-reference';
import type { ChatMetadata } from '~/types/chat';
import type {
  ChatUIMessage,
  PreparationStage,
  PreparationStageAnnotation,
  UPageBlockAnnotation,
} from '~/types/message';
import type { PageData } from '~/types/pages';
import { isAbortError, throwIfAborted } from '../abort';
import { createSummary } from '../create-summary';
import { generateDesignMd } from '../generate-design-md';
import { buildContextFromPages, buildPageSelectionCandidates, resolveSelectedPages } from '../preparation';
import { selectContext } from '../select-context';
import { structuredPageSnapshot } from '../structured-page-snapshot';
import type { StreamTextUIEvent } from '../ui-message-stream';
import { summarizeVisualReference } from '../visual-reference';
import type { PageBuilderAgentState } from './page-builder';
import { createPageBuilderMutationTools } from './page-builder-mutation-tools';
import { createOptionalPageBuilderTools } from './page-builder-optional-tools';

export type PreparationToolName =
  | 'historySummary'
  | 'selectRelevantPages'
  | 'buildPageOutlineSnapshot'
  | 'buildPageDetailedSnapshot'
  | 'ensureDesignSystem';
export type PageBuilderToolName = PreparationToolName | 'announceUpageBlock' | 'upage' | 'finishRun';
const MAX_DETAILED_SNAPSHOT_PAGES = 2;

type PageBuilderToolContext = {
  request: Request;
  chatId: string;
  chatMetadata: ChatMetadata | null;
  previousMessages: ChatUIMessage[];
  currentMessage: ChatUIMessage;
  state: PageBuilderAgentState;
  clientDesignMd?: string;
  onMinorModelUsage?: (usage: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    reasoningTokens?: number;
    cachedInputTokens?: number;
  }) => void;
  onDesignSystemStreamEvent?: (event: StreamTextUIEvent) => void;
  onUpageBlockStart?: (block: UPageBlockAnnotation) => void;
  emitPreparationStage: (event: Omit<PreparationStageAnnotation, 'order' | 'label'>) => void;
  createPreparationReasoningForwarder: (stage: PreparationStage, message: string) => (event: StreamTextUIEvent) => void;
  markEffectiveTool: (toolName: string) => void;
  markInvalidToolCall: (
    toolName: PageBuilderToolName,
    reason: string,
    stopReason?: PageBuilderAgentState['guardrailStopReason'],
  ) => void;
  ensureRawPagesLoaded: () => Promise<PageData[]>;
  ensureSelectedPages: (allowFallback: boolean) => Promise<PageData[]>;
  announcedBlockKeys: Set<string>;
  submittedActionKeys: Set<string>;
};

export function createPageBuilderTools({
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
  announcedBlockKeys,
  submittedActionKeys,
}: PageBuilderToolContext) {
  const optionalTools = createOptionalPageBuilderTools();

  const getDefaultModelSelection = () => {
    const capabilities = getModelCapabilities(DEFAULT_PROVIDER, DEFAULT_MODEL);
    return {
      provider: DEFAULT_PROVIDER,
      providerName: DEFAULT_PROVIDER.name,
      modelName: DEFAULT_MODEL,
      capabilities,
      supportsVision: capabilities.supportsVisionInput,
      getModel: () => getModel(DEFAULT_MODEL),
    };
  };

  const getMinorModelSelection = () => {
    const capabilities = getModelCapabilities(DEFAULT_PROVIDER, MINOR_MODEL);
    return {
      provider: DEFAULT_PROVIDER,
      providerName: DEFAULT_PROVIDER.name,
      modelName: MINOR_MODEL,
      capabilities,
      supportsVision: capabilities.supportsVisionInput,
      getModel: (executionMode: 'default' | 'no-thinking' = 'default') => getModel(MINOR_MODEL, { executionMode }),
    };
  };

  const getVisionSidecarSelection = () => {
    if (!VISION_PROVIDER_NAME || !VISION_MODEL) {
      return null;
    }

    const provider = getProviderByName(VISION_PROVIDER_NAME);
    const capabilities = getModelCapabilities(provider, VISION_MODEL);
    return {
      provider,
      providerName: provider.name,
      modelName: VISION_MODEL,
      capabilities,
      supportsVision: capabilities.supportsVisionInput,
      getModel: (executionMode: 'default' | 'no-thinking' = 'default') =>
        getLanguageModelByProvider(VISION_PROVIDER_NAME, VISION_MODEL, { executionMode }),
    };
  };

  const getCurrentTaskText = (options?: { includeVisualSummary?: boolean }) => {
    return currentMessage.role === 'user'
      ? getUserMessageContent(currentMessage, {
          includeVisualHint: true,
          visualSummary: options?.includeVisualSummary ? state.visualSummary : undefined,
        })
      : '';
  };

  const materializeCurrentMessageForModel = async (selection: {
    capabilities: {
      supportsImageUrl: boolean;
      supportsBase64Image: boolean;
    };
  }) => {
    return await materializeMessageFileReferencesForModel({
      request,
      message: currentMessage,
      supportsImageUrl: selection.capabilities.supportsImageUrl,
      supportsBase64Image: selection.capabilities.supportsBase64Image,
    });
  };

  const ensureVisualSummary = async () => {
    if (state.visualSummaryReady) {
      return state.visualSummary;
    }

    if (currentMessage.role !== 'user' || !hasUserImageParts(currentMessage)) {
      state.visualSummaryReady = true;
      state.visualMode = 'none';
      return '';
    }

    const candidates = [getVisionSidecarSelection(), getMinorModelSelection(), getDefaultModelSelection()].filter(
      (item): item is NonNullable<typeof item> => Boolean(item),
    );
    const candidate = candidates.find((item) => item.supportsVision);

    if (!candidate) {
      state.visualSummaryReady = true;
      state.visualMode = 'limited';
      state.preparationWarnings.push('当前未配置可用的视觉模型，已退化为仅文本模式。');
      return '';
    }

    const result = await summarizeVisualReference({
      message: await materializeCurrentMessageForModel(candidate),
      model: candidate.getModel(),
      abortSignal: request.signal,
    });
    state.visualSummary = result.summary;
    state.visualSummaryReady = true;
    state.visualMode =
      candidate.providerName === DEFAULT_PROVIDER.name && candidate.modelName === DEFAULT_MODEL ? 'direct' : 'sidecar';
    onMinorModelUsage?.(result.totalUsage);
    return state.visualSummary;
  };

  const persistDesignMd = async (designMd: string) => {
    const nextMetadata: ChatMetadata = {
      ...(chatMetadata ?? {}),
      sessionType: 'agent-page-builder',
      designMd,
    };

    await updateChat(chatId, { metadata: nextMetadata });
  };

  const historySummaryTool = tool({
    description: '按需总结当前会话中的历史消息，提炼对本轮页面生成有帮助的摘要。',
    inputSchema: z.object({}),
    execute: async () => {
      if (state.summaryReady) {
        markEffectiveTool('historySummary');
        return {
          hasHistory: previousMessages.length > 0,
          summary: state.summary,
          reused: true,
          warnings: state.preparationWarnings,
          durationMs: state.preparationDurationMs,
        };
      }

      if (previousMessages.length === 0) {
        state.summaryReady = true;
        emitPreparationStage({
          stage: 'history-summary',
          status: 'skipped',
          message: '当前没有历史消息，跳过历史摘要。',
        });
        markEffectiveTool('historySummary');
        return {
          hasHistory: false,
          summary: '',
          reused: false,
          warnings: state.preparationWarnings,
        };
      }

      const startedAt = Date.now();

      try {
        const visualSummary =
          currentMessage.role === 'user' && hasUserImageParts(currentMessage) ? await ensureVisualSummary() : '';
        emitPreparationStage({
          stage: 'history-summary',
          status: 'in-progress',
          message: '正在总结历史对话。',
        });

        const createSummaryResult = await createSummary({
          messages: [...previousMessages, currentMessage],
          visualSummary,
          model: getModel(MINOR_MODEL),
          abortSignal: request.signal,
          onStreamEvent: createPreparationReasoningForwarder('history-summary', '正在总结历史对话。'),
          onAbortUsage: onMinorModelUsage,
        });

        state.summary = createSummaryResult.text;
        state.summaryReady = true;
        state.preparationDurationMs = Date.now() - startedAt;
        onMinorModelUsage?.(createSummaryResult.totalUsage);
        emitPreparationStage({
          stage: 'history-summary',
          status: 'complete',
          message: '历史对话摘要已生成。',
        });
        markEffectiveTool('historySummary');

        return {
          hasHistory: true,
          summary: state.summary,
          reused: false,
          warnings: state.preparationWarnings,
          durationMs: state.preparationDurationMs,
        };
      } catch (error) {
        if (isAbortError(error, request.signal)) {
          throw error;
        }

        state.errorPhase = 'summary_failed';
        const warning = error instanceof Error ? error.message : '摘要生成失败';
        state.preparationWarnings.push(`聊天摘要生成失败，已跳过：${warning}`);
        emitPreparationStage({
          stage: 'history-summary',
          status: 'warning',
          message: '历史对话摘要生成失败，已跳过。',
          warning,
        });
        markEffectiveTool('historySummary');

        return {
          hasHistory: true,
          summary: state.summary,
          reused: false,
          warnings: state.preparationWarnings,
          durationMs: Date.now() - startedAt,
        };
      }
    },
  });

  const selectRelevantPagesTool = tool({
    description: '按需从历史页面中挑选与本轮任务最相关的页面，供后续快照和页面编辑使用。',
    inputSchema: z.object({}),
    execute: async () => {
      if (state.contextReady) {
        markEffectiveTool('selectRelevantPages');
        return {
          hasPages: state.rawPages.length > 0,
          selectedPages: state.selectedPages.map((page) => page.name),
          candidatePages: state.candidatePages,
          reused: true,
          usedFallback: false,
          warnings: state.preparationWarnings,
        };
      }

      const startedAt = Date.now();
      const rawPages = await ensureRawPagesLoaded();
      if (rawPages.length === 0) {
        state.contextReady = true;
        emitPreparationStage({
          stage: 'candidate-pages',
          status: 'skipped',
          message: '没有可用的历史页面，跳过页面筛选。',
        });
        markEffectiveTool('selectRelevantPages');
        return {
          hasPages: false,
          selectedPages: [],
          candidatePages: [],
          reused: false,
          usedFallback: false,
          warnings: state.preparationWarnings,
        };
      }

      emitPreparationStage({
        stage: 'candidate-pages',
        status: 'in-progress',
        message: `正在筛选相关页面（共 ${rawPages.length} 页）。`,
      });

      try {
        const visualSummary =
          currentMessage.role === 'user' && hasUserImageParts(currentMessage) ? await ensureVisualSummary() : '';
        const pageSelectionCandidates = buildPageSelectionCandidates(rawPages);
        const selectContextResult = await selectContext({
          messages: [...previousMessages, currentMessage],
          summary: state.summary || getCurrentTaskText({ includeVisualSummary: Boolean(visualSummary) }),
          visualSummary,
          pages: pageSelectionCandidates,
          model: getModel(MINOR_MODEL),
          abortSignal: request.signal,
          onStreamEvent: createPreparationReasoningForwarder(
            'candidate-pages',
            `正在筛选相关页面（共 ${rawPages.length} 页）。`,
          ),
          onAbortUsage: onMinorModelUsage,
        });

        onMinorModelUsage?.(selectContextResult.totalUsage);
        const selectedPageNames = Object.keys(selectContextResult.context);
        state.selectedPages = resolveSelectedPages(rawPages, selectedPageNames);
        state.candidatePages = state.selectedPages.map((page) => page.name);
        state.context = buildContextFromPages(state.selectedPages);
        state.contextReady = true;

        const usedFallback = selectedPageNames.length === 0;
        emitPreparationStage({
          stage: 'candidate-pages',
          status: 'complete',
          message: usedFallback
            ? '未命中特定页面，已回退到最近页面。'
            : `已筛选 ${state.selectedPages.length} 个相关页面。`,
          selectedPages: state.candidatePages,
        });
        markEffectiveTool('selectRelevantPages');

        return {
          hasPages: true,
          selectedPages: state.selectedPages.map((page) => page.name),
          candidatePages: state.candidatePages,
          reused: false,
          usedFallback,
          warnings: state.preparationWarnings,
          durationMs: Date.now() - startedAt,
        };
      } catch (error) {
        if (isAbortError(error, request.signal)) {
          throw error;
        }

        state.errorPhase = 'context_failed';
        const warning = error instanceof Error ? error.message : '页面筛选失败';
        state.selectedPages = resolveSelectedPages(rawPages, []);
        state.candidatePages = state.selectedPages.map((page) => page.name);
        state.context = buildContextFromPages(state.selectedPages);
        state.contextReady = true;
        state.preparationWarnings.push(`相关页面筛选失败，已回退到默认页面：${warning}`);
        emitPreparationStage({
          stage: 'candidate-pages',
          status: 'warning',
          message: '页面筛选失败，已回退到默认页面。',
          selectedPages: state.candidatePages,
          warning,
        });
        markEffectiveTool('selectRelevantPages');

        return {
          hasPages: true,
          selectedPages: state.selectedPages.map((page) => page.name),
          candidatePages: state.candidatePages,
          reused: false,
          usedFallback: true,
          warnings: state.preparationWarnings,
          durationMs: Date.now() - startedAt,
        };
      }
    },
  });

  const buildPageOutlineSnapshotTool = tool({
    description: '按需为已选择的历史页面生成轻量结构概览，帮助 agent 快速理解页面大致布局和主要内容。',
    inputSchema: z.object({}),
    execute: async () => {
      if (state.snapshotReady) {
        markEffectiveTool('buildPageOutlineSnapshot');
        return {
          hasPages: state.selectedPages.length > 0,
          selectedPages: state.selectedPages.map((page) => page.name),
          pageSummaryOutline: state.pageSummaryOutline,
          reused: true,
          usedFallback: false,
          warnings: state.preparationWarnings,
        };
      }

      const startedAt = Date.now();
      const usedFallback = !state.contextReady;
      const selectedPages = await ensureSelectedPages(true);
      if (selectedPages.length === 0) {
        state.snapshotReady = true;
        emitPreparationStage({
          stage: 'page-snapshot',
          status: 'skipped',
          message: '没有候选页面，跳过页面概览。',
        });
        markEffectiveTool('buildPageOutlineSnapshot');
        return {
          hasPages: false,
          selectedPages: [],
          pageSummaryOutline: '',
          reused: false,
          usedFallback,
          warnings: state.preparationWarnings,
        };
      }

      emitPreparationStage({
        stage: 'page-snapshot',
        status: 'in-progress',
        message: `正在快速提炼 ${selectedPages.length} 个页面的结构概览。`,
        selectedPages: selectedPages.map((page) => page.name),
      });

      try {
        const outlineSnapshotResult = await structuredPageSnapshot({
          pages: selectedPages,
          mode: 'outline',
          model: getModel(MINOR_MODEL, { executionMode: 'no-thinking' }),
          abortSignal: request.signal,
          onAbortUsage: onMinorModelUsage,
        });

        state.pageSummaryOutline = outlineSnapshotResult.text;
        state.snapshotReady = true;
        state.snapshotPhase = state.pageSummaryDetailed ? 'detailed' : 'outline';
        state.contextReady = true;
        onMinorModelUsage?.(outlineSnapshotResult.totalUsage);
        emitPreparationStage({
          stage: 'page-snapshot',
          status: 'complete',
          message: '页面结构概览已生成。',
          selectedPages: selectedPages.map((page) => page.name),
        });
        markEffectiveTool('buildPageOutlineSnapshot');

        return {
          hasPages: true,
          selectedPages: selectedPages.map((page) => page.name),
          pageSummaryOutline: state.pageSummaryOutline,
          reused: false,
          usedFallback,
          warnings: state.preparationWarnings,
          durationMs: Date.now() - startedAt,
        };
      } catch (error) {
        if (isAbortError(error, request.signal)) {
          throw error;
        }

        state.errorPhase = 'context_failed';
        const warning = error instanceof Error ? error.message : '页面概览生成失败';
        state.preparationWarnings.push(`页面概览生成失败，已跳过：${warning}`);
        emitPreparationStage({
          stage: 'page-snapshot',
          status: 'warning',
          message: '页面概览生成失败，已跳过。',
          selectedPages: selectedPages.map((page) => page.name),
          warning,
        });
        markEffectiveTool('buildPageOutlineSnapshot');

        return {
          hasPages: true,
          selectedPages: selectedPages.map((page) => page.name),
          pageSummaryOutline: state.pageSummaryOutline,
          reused: false,
          usedFallback,
          warnings: state.preparationWarnings,
          durationMs: Date.now() - startedAt,
        };
      }
    },
  });

  const buildPageDetailedSnapshotTool = tool({
    description: '按需结合当前任务对已选择的页面进行精确定位，输出更适合修改决策的重点位置分析。',
    inputSchema: z.object({}),
    execute: async () => {
      if (state.snapshotPhase === 'detailed') {
        markEffectiveTool('buildPageDetailedSnapshot');
        return {
          hasPages: state.selectedPages.length > 0,
          selectedPages: state.selectedPages.map((page) => page.name),
          pageSummaryDetailed: state.pageSummaryDetailed,
          reused: true,
          usedFallback: false,
          warnings: state.preparationWarnings,
        };
      }

      const startedAt = Date.now();
      const usedFallback = !state.contextReady;
      const selectedPages = await ensureSelectedPages(true);
      if (selectedPages.length === 0) {
        emitPreparationStage({
          stage: 'precise-locate',
          status: 'skipped',
          message: '没有候选页面，跳过精确定位。',
        });
        markEffectiveTool('buildPageDetailedSnapshot');
        return {
          hasPages: false,
          selectedPages: [],
          pageSummaryDetailed: '',
          reused: false,
          usedFallback,
          warnings: state.preparationWarnings,
        };
      }

      const precisePages = resolveSelectedPages(selectedPages, state.candidatePages, MAX_DETAILED_SNAPSHOT_PAGES);
      emitPreparationStage({
        stage: 'precise-locate',
        status: 'in-progress',
        message: `正在结合当前任务定位最相关的位置（最多 ${precisePages.length} 页）。`,
        selectedPages: precisePages.map((page) => page.name),
      });

      try {
        const visualSummary =
          currentMessage.role === 'user' && hasUserImageParts(currentMessage) ? await ensureVisualSummary() : '';
        const detailedSnapshotResult = await structuredPageSnapshot({
          pages: precisePages,
          mode: 'detailed',
          userTask: getCurrentTaskText({ includeVisualSummary: Boolean(visualSummary) }),
          model: getModel(MINOR_MODEL, { executionMode: 'no-thinking' }),
          abortSignal: request.signal,
          onAbortUsage: onMinorModelUsage,
        });

        state.pageSummaryDetailed = detailedSnapshotResult.text;
        state.snapshotPhase = 'detailed';
        onMinorModelUsage?.(detailedSnapshotResult.totalUsage);
        emitPreparationStage({
          stage: 'precise-locate',
          status: 'complete',
          message: '已定位与当前任务最相关的位置。',
          selectedPages: precisePages.map((page) => page.name),
        });
        markEffectiveTool('buildPageDetailedSnapshot');

        return {
          hasPages: true,
          selectedPages: precisePages.map((page) => page.name),
          pageSummaryDetailed: state.pageSummaryDetailed,
          reused: false,
          usedFallback,
          warnings: state.preparationWarnings,
          durationMs: Date.now() - startedAt,
        };
      } catch (error) {
        if (isAbortError(error, request.signal)) {
          throw error;
        }

        state.errorPhase = 'context_failed';
        const warning = error instanceof Error ? error.message : '精确定位失败';
        state.preparationWarnings.push(`精确定位失败，已跳过：${warning}`);
        emitPreparationStage({
          stage: 'precise-locate',
          status: 'warning',
          message: '精确定位失败，已跳过。',
          selectedPages: precisePages.map((page) => page.name),
          warning,
        });
        markEffectiveTool('buildPageDetailedSnapshot');

        return {
          hasPages: true,
          selectedPages: precisePages.map((page) => page.name),
          pageSummaryDetailed: state.pageSummaryDetailed,
          reused: false,
          usedFallback,
          warnings: state.preparationWarnings,
          durationMs: Date.now() - startedAt,
        };
      }
    },
  });

  const ensureDesignSystemTool = tool({
    description: '确保当前会话存在可复用的 DESIGN.md 设计系统规范。若没有，则立即生成一份。',
    inputSchema: z.object({}),
    execute: async () => {
      if (clientDesignMd && clientDesignMd !== chatMetadata?.designMd) {
        await persistDesignMd(clientDesignMd);
        state.designMd = clientDesignMd;
        state.designReady = true;
      }

      if (state.designMd && state.designReady && state.lastEffectiveTool === 'ensureDesignSystem') {
        markEffectiveTool('ensureDesignSystem');
        emitPreparationStage({
          stage: 'design-system',
          status: 'complete',
          message: '已复用现有设计系统。',
        });
        return {
          reused: true,
          content: state.designMd,
        };
      }

      if (state.designMd) {
        state.designReady = true;
        emitPreparationStage({
          stage: 'design-system',
          status: 'complete',
          message: '已复用现有设计系统。',
        });
        markEffectiveTool('ensureDesignSystem');
        return {
          reused: true,
          content: state.designMd,
        };
      }

      const visualSummary =
        currentMessage.role === 'user' && hasUserImageParts(currentMessage) ? await ensureVisualSummary() : '';
      const maxRetries = 2;
      let lastError: unknown;

      emitPreparationStage({
        stage: 'design-system',
        status: 'in-progress',
        message: '正在准备设计系统规范。',
      });

      for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
        try {
          const modelCandidates = [
            getVisionSidecarSelection(),
            getMinorModelSelection(),
            getDefaultModelSelection(),
          ].filter((item): item is NonNullable<typeof item> => Boolean(item));
          const modelSelection = modelCandidates.find((item) => item.supportsVision) || getMinorModelSelection();
          const generatedDesignResult = await generateDesignMd({
            userMessage: await materializeCurrentMessageForModel(modelSelection),
            visualSummary,
            modelCapabilities: modelSelection.capabilities,
            model: modelSelection.getModel(),
            abortSignal: request.signal,
            onStreamEvent: (event) => {
              onDesignSystemStreamEvent?.(event);
            },
            onAbortUsage: onMinorModelUsage,
          });

          throwIfAborted(request.signal);
          onMinorModelUsage?.(generatedDesignResult.totalUsage);
          await persistDesignMd(generatedDesignResult.content);
          state.designMd = generatedDesignResult.content;
          state.designReady = true;

          emitPreparationStage({
            stage: 'design-system',
            status: 'complete',
            message:
              currentMessage.role === 'user' &&
              hasUserImageParts(currentMessage) &&
              !modelSelection.capabilities.supportsVisionInput
                ? '设计系统规范已生成（基于视觉摘要降级生成）。'
                : '设计系统规范已生成。',
          });
          markEffectiveTool('ensureDesignSystem');

          return {
            reused: false,
            content: generatedDesignResult.content,
          };
        } catch (error) {
          if (isAbortError(error, request.signal)) {
            throw error;
          }

          lastError = error;
        }
      }

      state.errorPhase = 'design_system_failed';
      emitPreparationStage({
        stage: 'design-system',
        status: 'failed',
        message: '设计系统规范生成失败。',
        warning: lastError instanceof Error ? lastError.message : '设计系统规范生成失败',
      });
      throw lastError instanceof Error ? lastError : new Error('设计系统规范生成失败，请稍后重试');
    },
  });

  const { announceUpageBlockTool, upageTool, finishRunTool } = createPageBuilderMutationTools({
    state,
    onUpageBlockStart,
    markEffectiveTool,
    markInvalidToolCall,
    announcedBlockKeys,
    submittedActionKeys,
  });

  return {
    historySummary: historySummaryTool,
    selectRelevantPages: selectRelevantPagesTool,
    buildPageOutlineSnapshot: buildPageOutlineSnapshotTool,
    buildPageDetailedSnapshot: buildPageDetailedSnapshotTool,
    ensureDesignSystem: ensureDesignSystemTool,
    announceUpageBlock: announceUpageBlockTool,
    upage: upageTool,
    finishRun: finishRunTool,
    ...optionalTools,
  };
}

export type PageBuilderTools = ReturnType<typeof createPageBuilderTools>;
