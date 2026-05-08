import type { UPageAction } from './actions';
import type { UPageArtifactData } from './artifact';

export type UPagePagePart = {
  artifact: UPageArtifactData;
  actions: UPageAction[];
  summary?: string;
};

export type HistorySummaryToolOutput = {
  hasHistory: boolean;
  summary: string;
  reused: boolean;
  warnings?: string[];
  durationMs?: number;
};

export type SelectRelevantPagesToolOutput = {
  hasPages: boolean;
  selectedPages: string[];
  candidatePages: string[];
  reused: boolean;
  usedFallback: boolean;
  warnings?: string[];
  durationMs?: number;
};

type BasePageSnapshotToolOutput = {
  hasPages: boolean;
  selectedPages: string[];
  reused: boolean;
  usedFallback: boolean;
  warnings?: string[];
  durationMs?: number;
};

export type BuildPageOutlineSnapshotToolOutput = BasePageSnapshotToolOutput & {
  pageSummaryOutline: string;
};

export type BuildPageDetailedSnapshotToolOutput = BasePageSnapshotToolOutput & {
  pageSummaryDetailed: string;
};

// 向后兼容旧消息记录中的单工具快照结果。
export type BuildPageSnapshotToolOutput = BasePageSnapshotToolOutput & {
  pageSummary: string;
  pageSummaryOutline: string;
  pageSummaryDetailed: string;
  detailLevel: 'outline' | 'detailed';
  snapshotPhase: 'none' | 'outline' | 'detailed';
};

export type EnsureDesignSystemToolOutput = {
  reused: boolean;
  content: string;
};

export type FinishRunToolOutput = {
  acknowledged: boolean;
  reason?: string;
  requiresMutation: boolean;
  effectiveMutationCount: number;
  invalidStepCount: number;
};

export type AnnounceUpageBlockToolOutput = {
  pageName: string;
  actionCount: number;
  announcedActions: string[];
};

export type UPageToolOutput = {
  pages: UPagePagePart[];
  emittedPages: string[];
  pageCount: number;
};

export type PageBuilderCoreUITools = {
  historySummary: {
    input: Record<string, never>;
    output: HistorySummaryToolOutput;
  };
  selectRelevantPages: {
    input: Record<string, never>;
    output: SelectRelevantPagesToolOutput;
  };
  buildPageOutlineSnapshot: {
    input: Record<string, never>;
    output: BuildPageOutlineSnapshotToolOutput;
  };
  buildPageDetailedSnapshot: {
    input: Record<string, never>;
    output: BuildPageDetailedSnapshotToolOutput;
  };
  buildPageSnapshot: {
    input: {
      detailLevel?: 'outline' | 'detailed';
    };
    output: BuildPageSnapshotToolOutput;
  };
  ensureDesignSystem: {
    input: Record<string, never>;
    output: EnsureDesignSystemToolOutput;
  };
  announceUpageBlock: {
    input: {
      artifact: UPageArtifactData;
      actions: Array<
        Pick<UPageAction, 'id' | 'action' | 'pageName' | 'sort'> & {
          contentKind?: 'html' | 'patch';
          domId?: string;
          rootDomId?: string;
        }
      >;
    };
    output: AnnounceUpageBlockToolOutput;
  };
  upage: {
    input: {
      pages: UPagePagePart[];
    };
    output: UPageToolOutput;
  };
  finishRun: {
    input: {
      reason?: string;
      requiresMutation: boolean;
    };
    output: FinishRunToolOutput;
  };
};

// 这些工具是否可用由后端环境变量决定，消息类型需要允许它们出现，
// 但运行时并不保证每次 agent 都会装配。
export type PageBuilderOptionalUITools = {
  serper: {
    input: {
      q: string;
      autocorrect: boolean;
      gl: string;
      hl: string;
      page: number;
      num: number;
      type: 'search' | 'images' | 'videos' | 'places' | 'news' | 'shopping';
    };
    output: Record<string, unknown>;
  };
  weather: {
    input: {
      q: string;
    };
    output: Record<string, unknown>;
  };
};

export type PageBuilderUITools = PageBuilderCoreUITools & PageBuilderOptionalUITools;
export type PageBuilderCoreToolName = keyof PageBuilderCoreUITools;
export type PageBuilderOptionalToolName = keyof PageBuilderOptionalUITools;
