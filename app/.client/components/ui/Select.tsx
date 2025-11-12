import classNames from 'classnames';
import { forwardRef } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  options: SelectOption[];
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(({ className, options, ...props }, ref) => {
  return (
    <div className={classNames('relative z-10', className)}>
      <select
        className={classNames(
          'w-full px-3 py-2 rounded-lg text-sm bg-[#F8F8F8] dark:bg-[#1A1A1A] border border-[#E5E5E5] dark:border-[#333333] text-upage-elements-textPrimary appearance-none pr-8 focus:outline-none focus:ring-1 focus:ring-upage-elements-borderColorActive disabled:opacity-50',
        )}
        ref={ref}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
        <div className="i-ph:caret-down size-4 text-gray-500 dark:text-gray-400" />
      </div>
    </div>
  );
});

Select.displayName = 'Select';

export { Select };
