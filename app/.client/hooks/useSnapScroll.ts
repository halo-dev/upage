import { useCallback, useRef } from 'react';
import { throttle } from '~/.client/utils/throttle';

interface ScrollOptions {
  duration?: number;
  easing?: 'ease' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'cubic-bezier';
  cubicBezier?: [number, number, number, number];
  bottomThreshold?: number;
  throttleTime?: number;
}

export function useSnapScroll(options: ScrollOptions = {}) {
  const {
    duration = 800,
    easing = 'ease-in-out',
    cubicBezier = [0.42, 0, 0.58, 1],
    bottomThreshold = 50,
    throttleTime = 200,
  } = options;

  const autoScrollRef = useRef(true);
  const scrollNodeRef = useRef<HTMLDivElement | null>(null);
  const onScrollRef = useRef<() => void>();
  const observerRef = useRef<ResizeObserver | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const animationFrameRef = useRef<number>(0);
  const lastScrollTopRef = useRef<number>(0);
  const throttledSmoothScrollRef = useRef<(...args: any[]) => void>();

  const smoothScroll = useCallback(
    (element: HTMLDivElement, targetPosition: number, duration: number, easingFunction: string) => {
      const startPosition = element.scrollTop;
      const distance = targetPosition - startPosition;
      const startTime = performance.now();

      const bezierPoints = easingFunction === 'cubic-bezier' ? cubicBezier : [0.42, 0, 0.58, 1];

      const cubicBezierFunction = (t: number): number => {
        const [, y1, , y2] = bezierPoints;

        /*
         * const cx = 3 * x1;
         * const bx = 3 * (x2 - x1) - cx;
         * const ax = 1 - cx - bx;
         */

        const cy = 3 * y1;
        const by = 3 * (y2 - y1) - cy;
        const ay = 1 - cy - by;

        // const sampleCurveX = (t: number) => ((ax * t + bx) * t + cx) * t;
        const sampleCurveY = (t: number) => ((ay * t + by) * t + cy) * t;

        return sampleCurveY(t);
      };

      const animation = (currentTime: number) => {
        const elapsedTime = currentTime - startTime;
        const progress = Math.min(elapsedTime / duration, 1);

        const easedProgress = cubicBezierFunction(progress);
        const newPosition = startPosition + distance * easedProgress;

        // Only scroll if auto-scroll is still enabled
        if (autoScrollRef.current) {
          element.scrollTop = newPosition;
        }

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        if (progress < 1 && autoScrollRef.current) {
          timeoutRef.current = setTimeout(() => {
            animation(performance.now());
          });
        }
      };

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        animation(performance.now());
      });
    },
    [cubicBezier],
  );

  // 创建节流版本的 smoothScroll 函数
  useCallback(() => {
    throttledSmoothScrollRef.current = throttle(
      (element: HTMLDivElement, targetPosition: number, duration: number, easingFunction: string) => {
        smoothScroll(element, targetPosition, duration, easingFunction);
      },
      throttleTime,
    );
  }, [smoothScroll, throttleTime])();

  const isScrolledToBottom = useCallback(
    (element: HTMLDivElement): boolean => {
      const { scrollTop, scrollHeight, clientHeight } = element;
      return scrollHeight - scrollTop - clientHeight <= bottomThreshold;
    },
    [bottomThreshold],
  );

  const messageRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) {
        const observer = new ResizeObserver(() => {
          if (autoScrollRef.current && scrollNodeRef.current && throttledSmoothScrollRef.current) {
            const { scrollHeight, clientHeight } = scrollNodeRef.current;
            const scrollTarget = scrollHeight - clientHeight;
            throttledSmoothScrollRef.current(scrollNodeRef.current, scrollTarget, duration, easing);
          }
        });

        observer.observe(node);
        observerRef.current = observer;
        return;
      }
      observerRef.current?.disconnect();
      observerRef.current = null;

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = 0;
      }
    },
    [duration, easing],
  );

  const scrollRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (node) {
        onScrollRef.current = () => {
          const { scrollTop } = node;

          // Detect scroll direction
          const isScrollingUp = scrollTop < lastScrollTopRef.current;

          // Update auto-scroll based on scroll direction and position
          if (isScrollingUp) {
            // Disable auto-scroll when scrolling up
            autoScrollRef.current = false;
          } else if (isScrolledToBottom(node)) {
            // Re-enable auto-scroll when manually scrolled to bottom
            autoScrollRef.current = true;
          }

          // Store current scroll position for next comparison
          lastScrollTopRef.current = scrollTop;
        };

        node.addEventListener('scroll', onScrollRef.current);
        scrollNodeRef.current = node;
      } else {
        if (onScrollRef.current && scrollNodeRef.current) {
          scrollNodeRef.current.removeEventListener('scroll', onScrollRef.current);
        }

        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = 0;
        }

        scrollNodeRef.current = null;
        onScrollRef.current = undefined;
      }
    },
    [isScrolledToBottom],
  );

  return [messageRef, scrollRef] as const;
}
