import classNames from 'classnames';
import { motion } from 'framer-motion';
import { memo } from 'react';
import { cubicEasingFn } from '~/.client/utils/easings';
import { genericMemo } from '~/.client/utils/react';

export type SliderOptions<T> = {
  left: { value: T; text: string };
  middle?: { value: T; text: string };
  right: { value: T; text: string };
};

interface SliderProps<T> {
  selected: T;
  options: SliderOptions<T>;
  disabled?: boolean;
  setSelected?: (selected: T) => void;
}

export const Slider = genericMemo(<T,>({ selected, options, setSelected, disabled = false }: SliderProps<T>) => {
  const hasMiddle = !!options.middle;
  const isLeftSelected = hasMiddle ? selected === options.left.value : selected === options.left.value;
  const isMiddleSelected = hasMiddle && options.middle ? selected === options.middle.value : false;

  return (
    <div className="flex items-center flex-wrap shrink-0 gap-1 bg-upage-elements-background-depth-1 overflow-hidden rounded-full p-1">
      <SliderButton selected={isLeftSelected} setSelected={() => setSelected?.(options.left.value)} disabled={disabled}>
        {options.left.text}
      </SliderButton>

      {options.middle && (
        <SliderButton
          selected={isMiddleSelected}
          setSelected={() => setSelected?.(options.middle!.value)}
          disabled={disabled}
        >
          {options.middle.text}
        </SliderButton>
      )}

      <SliderButton
        selected={!isLeftSelected && !isMiddleSelected}
        setSelected={() => setSelected?.(options.right.value)}
        disabled={disabled}
      >
        {options.right.text}
      </SliderButton>
    </div>
  );
});

interface SliderButtonProps {
  selected: boolean;
  children: string | React.JSX.Element | Array<React.JSX.Element | string>;
  disabled?: boolean;
  setSelected: () => void;
}

const SliderButton = memo(({ selected, children, setSelected, disabled = false }: SliderButtonProps) => {
  return (
    <button
      onClick={disabled ? undefined : setSelected}
      className={classNames(
        'bg-transparent text-sm px-2.5 py-0.5 rounded-full relative',
        selected
          ? 'text-upage-elements-item-contentAccent'
          : 'text-upage-elements-item-contentDefault hover:text-upage-elements-item-contentAccent',
        disabled ? 'opacity-50 cursor-not-allowed hover:text-upage-elements-item-contentDefault' : '',
      )}
      disabled={disabled}
    >
      <span className="relative z-10">{children}</span>
      {selected && (
        <motion.span
          layoutId="pill-tab"
          transition={{ duration: 0.2, ease: cubicEasingFn }}
          className="absolute inset-0 z-0 bg-upage-elements-item-backgroundAccent rounded-full"
        ></motion.span>
      )}
    </button>
  );
});
