import { formatToolError } from '~/.client/utils/tool-error';
import type {
  AgentRunStatus,
  BuildPageDetailedSnapshotToolOutput,
  BuildPageOutlineSnapshotToolOutput,
  BuildPageSnapshotToolOutput,
  ChatUIMessage,
  EnsureDesignSystemToolOutput,
  HistorySummaryToolOutput,
  SelectRelevantPagesToolOutput,
  UPageToolOutput,
} from '~/types/message';

export type ToolPart = Extract<ChatUIMessage['parts'][number], { type: `tool-${string}` }>;

export function getToolPresentation(part: ToolPart, runStatus?: AgentRunStatus) {
  const toolName = part.type.replace('tool-', '');
  const title = getToolTitle(toolName);
  const isAborted = runStatus === 'aborted' && isRunningState(part.state);
  const isRunning = !isAborted && isRunningState(part.state);

  return {
    title,
    isRunning,
    statusLabel: isRunning ? `${title}执行中` : getStateLabel(part.state, isAborted),
    statusIconClass: getStatusIconClass(part.state, isAborted),
    summary: getToolSummary(part, isAborted),
  };
}

function getSnapshotLabel(output: BuildPageSnapshotToolOutput) {
  const isDetailed = output.snapshotPhase === 'detailed' || output.detailLevel === 'detailed';

  if (isDetailed) {
    return output.reused ? '已复用页面精定位结果' : '页面精定位结果已生成';
  }

  if (output.reused) {
    return '已复用页面结构概览';
  }

  return output.hasPages ? '页面结构概览已生成' : '当前无候选页面，已跳过页面快照';
}

function isRunningState(state: ToolPart['state']) {
  return state === 'input-streaming' || state === 'input-available';
}

function getToolTitle(toolName: string) {
  switch (toolName) {
    case 'historySummary':
      return '生成历史摘要';
    case 'selectRelevantPages':
      return '筛选相关页面';
    case 'buildPageOutlineSnapshot':
      return '构建页面概览';
    case 'buildPageDetailedSnapshot':
      return '精确定位页面';
    case 'buildPageSnapshot':
      return '构建页面快照';
    case 'ensureDesignSystem':
      return '准备设计系统';
    case 'upage':
      return '应用页面变更';
    case 'finishRun':
      return '结束运行';
    case 'serper':
      return '联网搜索';
    case 'weather':
      return '天气查询';
    default:
      return toolName;
  }
}

function getStateLabel(state: ToolPart['state'], isAborted: boolean) {
  if (isAborted) {
    return '已中断';
  }

  switch (state) {
    case 'input-streaming':
      return '输入中';
    case 'input-available':
      return '待执行';
    case 'approval-requested':
      return '等待确认';
    case 'approval-responded':
      return '确认完成';
    case 'output-available':
      return '已完成';
    case 'output-error':
      return '失败';
    case 'output-denied':
      return '已拒绝';
    default:
      return state;
  }
}

function getStatusIconClass(state: ToolPart['state'], isAborted: boolean) {
  if (isAborted) {
    return 'i-ph:stop-circle-fill text-upage-elements-textSecondary';
  }

  switch (state) {
    case 'output-available':
      return 'i-ph:check-circle-fill text-upage-elements-textSuccess';
    case 'output-error':
      return 'i-ph:x-circle-fill text-upage-elements-textError';
    case 'output-denied':
      return 'i-ph:prohibit text-upage-elements-textError';
    default:
      return 'i-svg-spinners:90-ring-with-bg text-upage-elements-textSecondary text-sm';
  }
}

function getToolSummary(part: ToolPart, isAborted: boolean) {
  if (isAborted) {
    if (part.type === 'tool-ensureDesignSystem') {
      return '设计系统规范生成已中断';
    }

    return '工具执行已中断';
  }

  if (part.state === 'output-error') {
    return formatToolError(part.type.replace('tool-', ''), part.errorText);
  }

  if (part.type === 'tool-ensureDesignSystem') {
    if (part.state === 'input-streaming') {
      return '正在生成设计系统规范...';
    }

    if (part.state === 'input-available') {
      return '正在准备设计系统规范...';
    }
  }

  if (part.state !== 'output-available') {
    return undefined;
  }

  if (part.type === 'tool-historySummary') {
    const output = part.output as HistorySummaryToolOutput;
    return [
      output.reused ? '已复用历史摘要' : output.hasHistory ? '历史摘要已生成' : '当前无历史消息，已跳过摘要',
      typeof output.durationMs === 'number' ? `耗时：${Math.round(output.durationMs)}ms` : undefined,
      output.warnings?.length ? `降级：${output.warnings.join('；')}` : undefined,
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (part.type === 'tool-selectRelevantPages') {
    const output = part.output as SelectRelevantPagesToolOutput;
    const selectedPages = output.selectedPages.length > 0 ? output.selectedPages.join('、') : '未筛选到特定页面';
    return [
      output.reused ? '已复用页面筛选结果' : output.hasPages ? '相关页面已筛选' : '当前无历史页面，已跳过筛选',
      `相关页面：${selectedPages}`,
      output.usedFallback ? '已使用默认回退页面' : undefined,
      typeof output.durationMs === 'number' ? `耗时：${Math.round(output.durationMs)}ms` : undefined,
      output.warnings?.length ? `降级：${output.warnings.join('；')}` : undefined,
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (part.type === 'tool-buildPageOutlineSnapshot') {
    const output = part.output as BuildPageOutlineSnapshotToolOutput;
    return [
      output.reused ? '已复用页面结构概览' : output.hasPages ? '页面结构概览已生成' : '当前无候选页面，已跳过页面概览',
      output.selectedPages.length > 0 ? `页面：${output.selectedPages.join('、')}` : undefined,
      output.usedFallback ? '页面概览使用了默认候选页面' : undefined,
      typeof output.durationMs === 'number' ? `耗时：${Math.round(output.durationMs)}ms` : undefined,
      output.warnings?.length ? `降级：${output.warnings.join('；')}` : undefined,
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (part.type === 'tool-buildPageDetailedSnapshot') {
    const output = part.output as BuildPageDetailedSnapshotToolOutput;
    return [
      output.reused
        ? '已复用页面精定位结果'
        : output.hasPages
          ? '页面精定位结果已生成'
          : '当前无候选页面，已跳过精确定位',
      output.selectedPages.length > 0 ? `页面：${output.selectedPages.join('、')}` : undefined,
      output.usedFallback ? '精确定位使用了默认候选页面' : undefined,
      typeof output.durationMs === 'number' ? `耗时：${Math.round(output.durationMs)}ms` : undefined,
      output.warnings?.length ? `降级：${output.warnings.join('；')}` : undefined,
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (part.type === 'tool-buildPageSnapshot') {
    const output = part.output as BuildPageSnapshotToolOutput;
    return [
      getSnapshotLabel(output),
      output.selectedPages.length > 0 ? `页面：${output.selectedPages.join('、')}` : undefined,
      output.usedFallback ? '页面快照使用了默认候选页面' : undefined,
      typeof output.durationMs === 'number' ? `耗时：${Math.round(output.durationMs)}ms` : undefined,
      output.warnings?.length ? `降级：${output.warnings.join('；')}` : undefined,
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (part.type === 'tool-ensureDesignSystem') {
    const output = part.output as EnsureDesignSystemToolOutput;
    return output.reused ? '已复用会话中的设计系统' : '已生成新的设计系统';
  }

  if (part.type === 'tool-upage') {
    const output = part.output as UPageToolOutput;
    return `已提交 ${output.pageCount} 个页面变更：${output.emittedPages.join('、')}`;
  }

  if (part.type === 'tool-finishRun') {
    const { effectiveMutationCount, invalidStepCount, reason } = part.output;
    return [`页面变更数：${effectiveMutationCount}`, `无效步骤：${invalidStepCount}`, reason]
      .filter(Boolean)
      .join('\n');
  }

  return undefined;
}
