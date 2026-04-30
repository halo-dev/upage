import React, { memo } from 'react';

interface FilePreviewProps {
  files: File[];
  onRemove: (index: number) => void;
}

const FilePreview: React.FC<FilePreviewProps> = memo(
  ({ files, onRemove }) => {
    if (!files || files.length === 0) {
      return null;
    }

    return (
      <div className="flex flex-row gap-2 overflow-x-auto px-1 pt-1">
        {files.map((file, index) => (
          <div
            key={file.name + file.size}
            className="relative shrink-0 rounded-xl border border-upage-elements-borderColor/60 bg-upage-elements-background-depth-2/45 p-2 shadow-sm"
          >
            <div className="relative">
              <img src={URL.createObjectURL(file)} alt={file.name} className="h-20 w-auto rounded-lg object-cover" />
              <button
                onClick={() => onRemove(index)}
                className="absolute right-1.5 top-1.5 z-10 flex size-6 items-center justify-center rounded-lg bg-black/75 shadow-md transition-colors hover:bg-black"
              >
                <div className="i-ph:x size-3 text-gray-200" />
              </button>
            </div>
            <div className="mt-2 max-w-36 truncate text-[11px] text-upage-elements-textSecondary">{file.name}</div>
          </div>
        ))}
      </div>
    );
  },
  (prevProps, nextProps) => {
    return prevProps.files === nextProps.files;
  },
);

export default FilePreview;
