import { cva, type VariantProps } from 'class-variance-authority';
import classNames from 'classnames';
import * as React from 'react';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-upage-elements-borderColor disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-[var(--upage-elements-button-primary-background)] text-[var(--upage-elements-button-primary-text)] hover:bg-[var(--upage-elements-button-primary-backgroundHover)] font-medium shadow-sm',
        destructive: 'bg-red-500 text-white hover:bg-red-600 font-medium shadow-sm',
        outline:
          'border border-upage-elements-borderColor bg-transparent hover:bg-upage-elements-background-depth-2 hover:text-upage-elements-textPrimary text-upage-elements-textPrimary dark:border-upage-elements-borderColorActive',
        secondary:
          'bg-[var(--upage-elements-button-secondary-background)] text-[var(--upage-elements-button-secondary-text)] hover:bg-[var(--upage-elements-button-secondary-backgroundHover)] font-medium',
        ghost: 'hover:bg-upage-elements-background-depth-1 hover:text-upage-elements-textPrimary',
        link: 'text-upage-elements-textPrimary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-10 rounded-md px-8',
        icon: 'size-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  _asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, _asChild = false, ...props }, ref) => {
    return <button className={classNames(buttonVariants({ variant, size }), className)} ref={ref} {...props} />;
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
