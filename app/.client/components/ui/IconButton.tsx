import classNames from 'classnames';
import { type ForwardedRef, forwardRef, memo } from 'react';
import WithTooltip from './Tooltip';

type IconSize = 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

interface BaseIconButtonProps {
  size?: IconSize;
  className?: string;
  iconClassName?: string;
  disabledClassName?: string;
  title?: string;
  disabled?: boolean;
  onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
}

type IconButtonWithoutChildrenProps = {
  icon: string;
  children?: undefined;
} & BaseIconButtonProps;

type IconButtonWithChildrenProps = {
  icon?: undefined;
  children: string | React.JSX.Element | React.JSX.Element[];
} & BaseIconButtonProps;

type IconButtonProps = IconButtonWithoutChildrenProps | IconButtonWithChildrenProps;

// Componente IconButton com suporte a refs
export const IconButton = memo(
  forwardRef(
    (
      {
        icon,
        size = 'xl',
        className,
        iconClassName,
        disabledClassName,
        disabled = false,
        title,
        onClick,
        children,
      }: IconButtonProps,
      ref: ForwardedRef<HTMLButtonElement>,
    ) => {
      return (
        <WithTooltip tooltip={title} position="bottom" maxWidth={220} delay={500}>
          <button
            ref={ref}
            className={classNames(
              'flex items-center text-upage-elements-item-contentDefault bg-transparent enabled:hover:text-upage-elements-item-contentActive rounded-md p-1 enabled:hover:bg-upage-elements-item-backgroundActive disabled:cursor-not-allowed',
              {
                [classNames('opacity-30', disabledClassName)]: disabled,
              },
              className,
            )}
            title={title}
            disabled={disabled}
            onClick={(event) => {
              if (disabled) {
                return;
              }

              onClick?.(event);
            }}
          >
            {children ? children : <div className={classNames(icon, getIconSize(size), iconClassName)}></div>}
          </button>
        </WithTooltip>
      );
    },
  ),
);

function getIconSize(size: IconSize) {
  if (size === 'sm') {
    return 'text-sm';
  } else if (size === 'md') {
    return 'text-md';
  } else if (size === 'lg') {
    return 'text-lg';
  } else if (size === 'xl') {
    return 'text-xl';
  } else {
    return 'text-2xl';
  }
}
