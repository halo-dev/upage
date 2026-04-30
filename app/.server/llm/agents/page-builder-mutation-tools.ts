import { tool } from 'ai';
import { z } from 'zod';
import type { UPageBlockAnnotation } from '~/types/message';
import { createUPageTool } from '../tools/upage';
import type { PageBuilderAgentState } from './page-builder';
import { shouldBlockPrematureFinishRun } from './page-builder-guard';

type MutationToolName = 'announceUpageBlock' | 'upage' | 'finishRun';

type MutationToolContext = {
  state: PageBuilderAgentState;
  onUpageBlockStart?: (block: UPageBlockAnnotation) => void;
  markEffectiveTool: (toolName: string) => void;
  markInvalidToolCall: (
    toolName: MutationToolName,
    reason: string,
    stopReason?: PageBuilderAgentState['guardrailStopReason'],
  ) => void;
  announcedBlockKeys: Set<string>;
  submittedActionKeys: Set<string>;
};

export function createPageBuilderMutationTools({
  state,
  onUpageBlockStart,
  markEffectiveTool,
  markInvalidToolCall,
  announcedBlockKeys,
  submittedActionKeys,
}: MutationToolContext) {
  const announceUpageBlockTool = tool({
    description:
      '在调用 upage 提交页面区块前，先声明本批次即将生成的页面与区块元信息，用于实时展示生成进度。不要包含 content。该工具只用于进度提示，不代表最终页面结果，且每批 upage 调用前必须先调用一次。',
    inputSchema: z.object({
      artifact: z.object({
        id: z.string().trim().min(1),
        name: z.string().trim().min(1),
        title: z.string().trim().min(1),
      }),
      actions: z
        .array(
          z.object({
            id: z.string().trim().min(1),
            action: z.enum(['add', 'update', 'remove']),
            pageName: z.string().trim().min(1),
            contentKind: z.enum(['html', 'patch']).optional().default('html'),
            domId: z.string().trim().min(1).optional().default('main'),
            rootDomId: z.string().trim().min(1).optional(),
            sort: z.number().optional(),
          }),
        )
        .min(1)
        .max(3),
    }),
    execute: async ({ artifact, actions }) => {
      const announced: string[] = [];

      for (const action of actions) {
        const blockKey = `${artifact.id}:${action.id}`;
        if (announcedBlockKeys.has(blockKey)) {
          continue;
        }

        announcedBlockKeys.add(blockKey);
        announced.push(action.id);
        onUpageBlockStart?.({
          artifact,
          action: {
            id: action.id,
            action: action.action,
            pageName: action.pageName,
            contentKind: action.contentKind || 'html',
            content: '',
            domId: action.domId || 'main',
            rootDomId: action.rootDomId || action.id,
            sort: action.sort,
            validRootDomId: false,
          },
          sequence: announced.length,
        });
      }

      markEffectiveTool('announceUpageBlock');
      if (announced.length === 0) {
        return {
          pageName: artifact.name,
          actionCount: 0,
          announcedActions: [],
          reused: true,
        };
      }

      return {
        pageName: artifact.name,
        actionCount: announced.length,
        announcedActions: announced,
        reused: false,
      };
    },
  });

  const upageTool = createUPageTool((page) => {
    let emittedNewAction = false;
    let newActionCount = 0;

    for (const action of page.actions) {
      const actionKey = `${page.artifact.id}:${action.id}`;
      if (submittedActionKeys.has(actionKey)) {
        continue;
      }

      submittedActionKeys.add(actionKey);
      emittedNewAction = true;
      newActionCount += 1;
    }

    if (emittedNewAction) {
      state.emittedPages.push(page);
      state.effectiveMutationCount += newActionCount;
      state.hasRejectedPageMutation = false;
      markEffectiveTool('upage');
      return;
    }

    state.hasRejectedPageMutation = true;
    markInvalidToolCall('upage', '本批次页面变更未产生新的 action', 'duplicate_action');
  });

  const finishRunTool = tool({
    description: '当你确认本轮页面生成任务已经完成，或者因 guardrail 需要结束循环时，调用此工具结束工具阶段。',
    inputSchema: z.object({
      reason: z.string().optional(),
      requiresMutation: z
        .boolean()
        .describe(
          '你对当前这轮请求的内部判断：true 表示这轮任务必须产生实际页面变更才算完成；false 表示本轮只需说明、分析、解释或明确无法修改。',
        ),
    }),
    execute: async ({ reason, requiresMutation }) => {
      if (shouldBlockPrematureFinishRun(state, requiresMutation)) {
        const blockedReason = requiresMutation
          ? '你已判断本轮任务必须产生实际页面变更，但当前还没有成功提交任何页面修改；请继续完成修改，或重新审视你的任务判断。'
          : '上一轮页面提交未产生有效变更，请先修正问题或明确说明无法继续修改';
        markInvalidToolCall('finishRun', blockedReason);
        return {
          acknowledged: false,
          reason: blockedReason,
          requiresMutation,
          effectiveMutationCount: state.effectiveMutationCount,
          invalidStepCount: state.invalidStepCount,
        };
      }

      const invalidStepCount = state.invalidStepCount;
      state.finishRequested = true;
      state.guardrailStopReason = state.guardrailStopReason || 'finished_by_agent';
      state.lastEffectiveTool = 'finishRun';

      return {
        acknowledged: true,
        reason,
        requiresMutation,
        effectiveMutationCount: state.effectiveMutationCount,
        invalidStepCount,
      };
    },
  });

  return {
    announceUpageBlockTool,
    upageTool,
    finishRunTool,
  };
}
