import classNames from 'classnames';
import { useMemo } from 'react';
import type { PreparationStageAnnotation, PreparationStageStatus } from '~/types/message';
import { Markdown } from './Markdown';
import { RunningStatus } from './RunningStatus';
import ThoughtBox from './ThoughtBox';

export function PreparationTimeline({
  parts,
  isStreaming = false,
}: {
  parts: PreparationStageAnnotation[];
  isStreaming?: boolean;
}) {
  const stages = useMemo(() => {
    const latestByStage = new Map<string, PreparationStageAnnotation>();
    for (const part of parts) {
      latestByStage.set(part.stage, part);
    }

    return [...latestByStage.values()].sort((left, right) => left.order - right.order);
  }, [parts]);

  if (stages.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-2">
      <div className="px-0.5">
        <div className="text-[12px] font-semibold text-upage-elements-textPrimary">上下文准备</div>
        <div className="mt-0.5 text-[10px] text-upage-elements-textSecondary">
          {isStreaming ? '已进入生成流程，仍会继续补充阶段结果。' : '正在分阶段准备摘要与页面上下文。'}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {stages.map((stage) => (
          <div
            key={`${stage.stage}-${stage.order}`}
            className="rounded-md border border-upage-elements-borderColor/50 bg-upage-elements-background-depth-1/20 px-2.5 py-2"
          >
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex min-w-0 items-start gap-2">
                <div className="mt-0.5 flex size-5.5 shrink-0 items-center justify-center rounded-full bg-upage-elements-background/85">
                  <StageIcon status={stage.status} label={stage.label} />
                </div>
                <div className="min-w-0">
                  <div className="text-[12px] font-medium leading-5 text-upage-elements-textPrimary">{stage.label}</div>
                  <div className="text-[12px] leading-[1.45] text-upage-elements-textSecondary">{stage.message}</div>
                </div>
              </div>
              <span className="mt-0.5 shrink-0 rounded-full bg-upage-elements-background/85 px-1.5 py-0.5 text-[10px] text-upage-elements-textSecondary">
                {getStageStatusLabel(stage.status)}
              </span>
            </div>
            {stage.detail || stage.warning || stage.selectedPages?.length || typeof stage.durationMs === 'number' ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5 pl-7 text-[11px] leading-4 text-upage-elements-textSecondary">
                {stage.selectedPages?.length ? (
                  <span className="rounded-full bg-upage-elements-background/80 px-2 py-1">
                    页面：{stage.selectedPages.join('、')}
                  </span>
                ) : null}
                {typeof stage.durationMs === 'number' ? (
                  <span className="rounded-full bg-upage-elements-background/80 px-2 py-1">
                    耗时：{Math.round(stage.durationMs)}ms
                  </span>
                ) : null}
                {stage.warning ? (
                  <span className="rounded-full bg-upage-elements-background/80 px-2 py-1">降级：{stage.warning}</span>
                ) : null}
              </div>
            ) : null}
            {stage.detail ? (
              <div className="mt-1.5 pl-7">
                <ThoughtBox title="思考过程" isRunning={stage.status === 'in-progress'}>
                  <Markdown>{stage.detail}</Markdown>
                </ThoughtBox>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function StageIcon({ status, label }: { status: PreparationStageStatus; label: string }) {
  if (status === 'in-progress') {
    return <RunningStatus label={`${label}执行中`} iconClassName="text-sm" />;
  }

  return <div className={classNames(getStatusIconClass(status), 'text-sm')} />;
}

function getStageStatusLabel(status: PreparationStageStatus) {
  switch (status) {
    case 'in-progress':
      return '进行中';
    case 'complete':
      return '已完成';
    case 'warning':
      return '已降级';
    case 'failed':
      return '失败';
    case 'skipped':
      return '已跳过';
    default:
      return status;
  }
}

function getStatusIconClass(status: PreparationStageStatus) {
  switch (status) {
    case 'complete':
      return 'i-ph:check-circle-fill text-upage-elements-textSuccess';
    case 'warning':
      return 'i-ph:warning-circle-fill text-upage-elements-textWarning';
    case 'failed':
      return 'i-ph:x-circle-fill text-upage-elements-textError';
    case 'skipped':
      return 'i-ph:minus-circle-fill text-upage-elements-textSecondary';
    default:
      return 'i-svg-spinners:90-ring-with-bg text-upage-elements-textSecondary';
  }
}
