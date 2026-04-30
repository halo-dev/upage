import { formatToolError } from '~/.client/utils/tool-error';
import type { ChatUIMessage, ProgressAnnotation } from '~/types/message';

type ToolPart = Extract<ChatUIMessage['parts'][number], { type: `tool-${string}` }>;

const TOOL_PROGRESS_ORDER_OFFSET = 1000;

export function mergeStreamingProgressAnnotations(
  baseProgress: ProgressAnnotation[],
  messages: ChatUIMessage[],
): ProgressAnnotation[] {
  const toolProgress = getToolProgressAnnotations(messages);

  if (toolProgress.length === 0) {
    return baseProgress;
  }

  return [...baseProgress, ...toolProgress];
}

export function getToolProgressAnnotations(messages: ChatUIMessage[]): ProgressAnnotation[] {
  const latestAssistantMessage = [...messages].reverse().find((message) => message.role === 'assistant');

  if (!latestAssistantMessage) {
    return [];
  }

  return (latestAssistantMessage.parts || []).flatMap((part, index) => {
    if (part.type === 'data-upage-block-start') {
      return [
        {
          label: `page-block-${part.data.artifact.id}-${part.data.action.id}`,
          status: 'in-progress',
          order: TOOL_PROGRESS_ORDER_OFFSET + index,
          message: '正在准备页面内容。',
        } satisfies ProgressAnnotation,
      ];
    }

    if (!isToolPart(part)) {
      return [];
    }

    const progress = mapToolPartToProgress(part, index);
    return progress ? [progress] : [];
  });
}

function mapToolPartToProgress(part: ToolPart, index: number): ProgressAnnotation | undefined {
  if (part.type === 'tool-upage') {
    return mapUpageToolProgress(part, index);
  }

  return undefined;
}

function mapUpageToolProgress(
  part: Extract<ChatUIMessage['parts'][number], { type: 'tool-upage' }>,
  index: number,
): ProgressAnnotation {
  const label = `page-change-${part.toolCallId || index}`;
  const order = TOOL_PROGRESS_ORDER_OFFSET + index;

  if (part.state === 'output-available') {
    return {
      label,
      status: 'complete',
      order,
      message: '页面变更已提交。',
    };
  }

  if (part.state === 'output-error') {
    return {
      label,
      status: 'stopped',
      order,
      message: formatToolError('upage', part.errorText) || '页面变更执行失败。',
    };
  }

  if (part.state === 'output-denied') {
    return {
      label,
      status: 'warning',
      order,
      message: '页面变更未获批准，已跳过。',
    };
  }

  return {
    label,
    status: 'in-progress',
    order,
    message: '正在生成页面内容。',
  };
}

function isToolPart(part: ChatUIMessage['parts'][number]): part is ToolPart {
  return part.type.startsWith('tool-');
}
