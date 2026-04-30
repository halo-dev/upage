import type { AgentRunStatus } from '~/types/message';
import { RunningStatus } from './RunningStatus';
import { getToolPresentation, type ToolPart } from './tool-presentation';

export function ToolInvocationCard({ part, runStatus }: { part: ToolPart; runStatus?: AgentRunStatus }) {
  const presentation = getToolPresentation(part, runStatus);

  return (
    <div className="rounded-md border border-upage-elements-borderColor/50 bg-upage-elements-background-depth-1/20 px-2.5 py-2">
      <div className="flex items-start justify-between gap-2.5 text-sm">
        <div className="flex min-w-0 items-start gap-2">
          <div className="mt-0.5 flex size-5.5 shrink-0 items-center justify-center rounded-full bg-upage-elements-background/85">
            {presentation.isRunning ? (
              <RunningStatus label={presentation.statusLabel} iconClassName="text-sm" />
            ) : (
              <div className={presentation.statusIconClass}></div>
            )}
          </div>
          <span className="text-[12px] font-medium leading-5 text-upage-elements-textPrimary">
            {presentation.title}
          </span>
        </div>
        {presentation.isRunning ? (
          <RunningStatus
            label={presentation.statusLabel}
            className="mt-0.5 shrink-0 rounded-full bg-upage-elements-background/85 px-1.5 py-0.5"
            iconClassName="text-sm"
          />
        ) : (
          <span className="mt-0.5 shrink-0 rounded-full bg-upage-elements-background/85 px-1.5 py-0.5 text-[10px] text-upage-elements-textSecondary">
            {presentation.statusLabel}
          </span>
        )}
      </div>
      {presentation.summary ? (
        <div className="mt-1 pl-7 text-[12px] leading-[1.45] text-upage-elements-textSecondary whitespace-pre-wrap">
          {presentation.summary}
        </div>
      ) : null}
    </div>
  );
}
