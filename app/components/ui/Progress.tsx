import classNames from 'classnames';
import * as React from 'react';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  color?: 'default' | 'purple' | 'red';
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, color = 'default', ...props }, ref) => {
    const getBarColor = () => {
      switch (color) {
        case 'purple':
          return 'bg-purple-500 dark:bg-purple-400';
        case 'red':
          return 'bg-orange-500 dark:bg-orange-400';
        default:
          return 'bg-upage-elements-textPrimary';
      }
    };

    return (
      <div
        ref={ref}
        className={classNames(
          'relative h-2 w-full overflow-hidden rounded-full bg-upage-elements-background',
          className,
        )}
        {...props}
      >
        <div
          className={classNames('size-full flex-1 transition-all', getBarColor())}
          style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
        />
      </div>
    );
  },
);

Progress.displayName = 'Progress';

export { Progress };
