import { useEffect, useRef } from 'react';

interface InlineInputProps {
  depth: number;
  placeholder: string;
  initialValue?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

const NODE_PADDING_LEFT = 8;

export function InlineInput({ depth, placeholder, initialValue = '', onSubmit, onCancel }: InlineInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();

        if (initialValue) {
          inputRef.current.value = initialValue;
          inputRef.current.select();
        }
      }
    }, 50);

    return () => clearTimeout(timer);
  }, [initialValue]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const value = inputRef.current?.value.trim();

      if (value) {
        onSubmit(value);
      }
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div
      className="flex items-center w-full px-2 bg-upage-elements-background-depth-4 border border-upage-elements-item-contentAccent py-0.5 text-upage-elements-textPrimary"
      style={{ paddingLeft: `${6 + depth * NODE_PADDING_LEFT}px` }}
    >
      <div className="scale-120 shrink-0 i-ph:file-plus text-upage-elements-textTertiary" />
      <input
        ref={inputRef}
        type="text"
        className="ml-2 flex-1 bg-transparent border-none outline-none py-0.5 text-sm text-upage-elements-textPrimary placeholder:text-upage-elements-textTertiary min-w-0"
        placeholder={placeholder}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          setTimeout(() => {
            if (document.activeElement !== inputRef.current) {
              onCancel();
            }
          }, 100);
        }}
      />
    </div>
  );
}
