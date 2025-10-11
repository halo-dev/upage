import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import classNames from 'classnames';
import * as React from 'react';

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={classNames(
      'peer size-4 shrink-0 rounded-sm border transition-colors',
      'bg-transparent dark:bg-transparent',
      'border-gray-400 dark:border-gray-600',
      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-purple-500 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-950',
      'disabled:cursor-not-allowed disabled:opacity-50',
      'data-[state=checked]:bg-purple-500 dark:data-[state=checked]:bg-purple-500',
      'data-[state=checked]:border-purple-500 dark:data-[state=checked]:border-purple-500',
      'data-[state=checked]:text-white',
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
      <div className="i-lucide:check size-3" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = 'Checkbox';

export { Checkbox };
