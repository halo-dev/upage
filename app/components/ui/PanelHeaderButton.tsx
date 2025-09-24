import classNames from 'classnames';
import { memo } from 'react';

interface PanelHeaderButtonProps {
  className?: string;
  disabledClassName?: string;
  disabled?: boolean;
  children: string | React.JSX.Element | Array<React.JSX.Element | string>;
  onClick?: (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => void;
}

export const PanelHeaderButton = memo(
  ({ className, disabledClassName, disabled = false, children, onClick }: PanelHeaderButtonProps) => {
    return (
      <button
        className={classNames(
          'flex items-center shrink-0 gap-1.5 px-1.5 rounded-md py-0.5 text-upage-elements-item-contentDefault bg-transparent enabled:hover:text-upage-elements-item-contentAccent enabled:hover:bg-upage-elements-item-backgroundActive disabled:cursor-not-allowed',
          {
            [classNames('opacity-30', disabledClassName)]: disabled,
          },
          className,
        )}
        disabled={disabled}
        onClick={(event) => {
          if (disabled) {
            return;
          }

          onClick?.(event);
        }}
      >
        {children}
      </button>
    );
  },
);
