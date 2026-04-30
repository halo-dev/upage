import type { ChatUIMessage } from '~/types/message';
import { ToolInvocationCard } from './ToolInvocationCard';

type ToolPart = Extract<ChatUIMessage['parts'][number], { type: `tool-${string}` }>;

export function AgentTimeline({ message }: { message: ChatUIMessage }) {
  const timelineParts = getVisibleTimelineParts(message.parts || []);

  if (timelineParts.length === 0) {
    return null;
  }

  let stepNumber = 0;

  return (
    <div className="flex flex-col gap-2">
      {timelineParts.map((part, index) => {
        if (part.type === 'step-start') {
          stepNumber += 1;
          return (
            <div key={`step-${index}`} className="text-xs text-upage-elements-textSecondary tracking-wide">
              步骤 {stepNumber}
            </div>
          );
        }

        return <ToolInvocationCard key={`tool-${index}`} part={part as ToolPart} />;
      })}
    </div>
  );
}

function getVisibleTimelineParts(parts: ChatUIMessage['parts']) {
  const visibleStepStartIndexes = getVisibleStepStartIndexes(parts);

  return parts.filter((part, index) => {
    if (part.type === 'step-start') {
      return visibleStepStartIndexes.has(index);
    }

    if (!isToolPart(part)) {
      return false;
    }

    return true;
  });
}

function getVisibleStepStartIndexes(parts: ChatUIMessage['parts']) {
  const indexes = new Set<number>();

  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    if (part.type !== 'step-start') {
      continue;
    }

    const nextStepIndex = parts.findIndex(
      (candidate, candidateIndex) => candidateIndex > index && candidate.type === 'step-start',
    );
    const stepEnd = nextStepIndex === -1 ? parts.length : nextStepIndex;
    const hasVisibleTool = parts.slice(index + 1, stepEnd).some((candidate) => isToolPart(candidate));

    if (hasVisibleTool) {
      indexes.add(index);
    }
  }

  return indexes;
}

function isToolPart(part: ChatUIMessage['parts'][number]): part is ToolPart {
  return part.type.startsWith('tool-');
}
