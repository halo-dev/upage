import { memo, useEffect, useRef } from 'react';
import { IconButton } from '~/components/ui/IconButton';
import type { PreviewInfo } from '~/lib/stores/previews';

interface PageDropdownProps {
  activePreviewIndex: number;
  setActivePreviewIndex: (index: number) => void;
  isDropdownOpen: boolean;
  setIsDropdownOpen: (value: boolean) => void;
  setHasSelectedPreview: (value: boolean) => void;
  previews: PreviewInfo[];
}

export const PageDropdown = memo(
  ({
    activePreviewIndex,
    setActivePreviewIndex,
    isDropdownOpen,
    setIsDropdownOpen,
    setHasSelectedPreview,
    previews,
  }: PageDropdownProps) => {
    const dropdownRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLDivElement>(null);

    // sort previews alphabetically by filename, preserving original index
    const sortedPreviews = previews
      .map((previewInfo, index) => ({ ...previewInfo, index }))
      .sort((a, b) => a.filename.localeCompare(b.filename));

    // close dropdown if user clicks outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsDropdownOpen(false);
        }
      };

      if (isDropdownOpen) {
        window.addEventListener('mousedown', handleClickOutside);
      } else {
        window.removeEventListener('mousedown', handleClickOutside);
      }

      return () => {
        window.removeEventListener('mousedown', handleClickOutside);
      };
    }, [isDropdownOpen]);

    return (
      <div className="relative z-max" ref={dropdownRef}>
        <div ref={buttonRef}>
          <IconButton icon="i-ph:files" onClick={() => setIsDropdownOpen(!isDropdownOpen)} />
        </div>
        {isDropdownOpen && (
          <div className="absolute top-full left-0 mt-1 bg-upage-elements-background-depth-2 border border-upage-elements-borderColor rounded shadow-sm min-w-[180px] dropdown-animation">
            <div className="px-4 py-2 border-b border-upage-elements-borderColor text-sm font-semibold text-upage-elements-textPrimary">
              页面
            </div>
            {sortedPreviews.map((preview) => (
              <div
                key={preview.filename}
                className="flex items-center px-4 py-2 cursor-pointer hover:bg-upage-elements-item-backgroundActive"
                onClick={() => {
                  setActivePreviewIndex(preview.index);
                  setIsDropdownOpen(false);
                  setHasSelectedPreview(true);
                }}
              >
                <span
                  className={
                    activePreviewIndex === preview.index
                      ? 'text-upage-elements-item-contentAccent'
                      : 'text-upage-elements-item-contentDefault group-hover:text-upage-elements-item-contentActive'
                  }
                >
                  {preview.filename}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  },
);
