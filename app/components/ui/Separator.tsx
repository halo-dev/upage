import * as SeparatorPrimitive from '@radix-ui/react-separator';
import classNames from 'classnames';

interface SeparatorProps {
  className?: string;
  orientation?: 'horizontal' | 'vertical';
}

export const Separator = ({ className, orientation = 'horizontal' }: SeparatorProps) => {
  return (
    <SeparatorPrimitive.Root
      className={classNames(
        'bg-upage-elements-borderColor',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      orientation={orientation}
    />
  );
};

export default Separator;
