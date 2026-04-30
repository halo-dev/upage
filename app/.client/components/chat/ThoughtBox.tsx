import classNames from 'classnames';
import { type PropsWithChildren, useEffect, useMemo, useRef, useState } from 'react';
import { RunningStatus } from './RunningStatus';

const AUTO_SCROLL_BOTTOM_THRESHOLD = 24;

const ThoughtBox = ({
  title,
  children,
  isRunning = false,
}: PropsWithChildren<{ title: string; isRunning?: boolean }>) => {
  const [isExpanded, setIsExpanded] = useState(isRunning);
  const contentRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const expanded = isRunning || isExpanded;
  const statusText = useMemo(() => {
    return expanded ? '点击收起' : '点击展开';
  }, [expanded]);

  const stopAutoScroll = () => {
    const content = contentRef.current;
    if (!content) {
      return;
    }

    if (content.scrollHeight > content.clientHeight) {
      shouldAutoScrollRef.current = false;
    }
  };

  useEffect(() => {
    if (isRunning) {
      shouldAutoScrollRef.current = true;
      setIsExpanded(true);
      return;
    }

    setIsExpanded(false);
  }, [isRunning]);

  useEffect(() => {
    if (!expanded || !contentRef.current) {
      return;
    }

    if (!shouldAutoScrollRef.current) {
      return;
    }

    contentRef.current.scrollTop = contentRef.current.scrollHeight;
  }, [children, expanded]);

  return (
    <div className="overflow-hidden rounded-lg border border-upage-elements-borderColor/55 bg-upage-elements-background/72">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => {
          if (isRunning) {
            return;
          }

          setIsExpanded((value) => !value);
        }}
        className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left transition-colors hover:bg-upage-elements-background-depth-2/45"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-upage-elements-background-depth-1 text-upage-elements-textSecondary">
            <div className="i-ph:brain-thin text-[15px]" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-upage-elements-textPrimary">{title}</div>
            <div className="mt-0.5 text-[11px] text-upage-elements-textSecondary">
              {isRunning ? <RunningStatus label={`${title}执行中`} iconClassName="text-sm" /> : statusText}
            </div>
          </div>
        </div>
        <div
          className={classNames(
            'i-ph:caret-down text-sm shrink-0 text-upage-elements-textSecondary transition-transform',
            expanded && 'rotate-180',
          )}
        />
      </button>

      <div
        className={classNames(
          'border-t border-upage-elements-borderColor/50 bg-upage-elements-background-depth-1/30',
          !expanded && 'hidden',
        )}
      >
        <div
          ref={contentRef}
          onWheelCapture={stopAutoScroll}
          onPointerDownCapture={stopAutoScroll}
          onTouchStartCapture={stopAutoScroll}
          onScroll={(event) => {
            const content = event.currentTarget;
            const distanceToBottom = content.scrollHeight - content.scrollTop - content.clientHeight;
            shouldAutoScrollRef.current = distanceToBottom <= AUTO_SCROLL_BOTTOM_THRESHOLD;
          }}
          className="max-h-64 overflow-y-auto px-3.5 py-3 text-[13px] leading-6 text-upage-elements-textPrimary"
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default ThoughtBox;
