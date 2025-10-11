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
      <div className="flex flex-row overflow-x-auto -mt-2">
        {files.map((file, index) => (
          <div key={file.name + file.size} className="mr-2 relative">
            <div className="relative pt-4 pr-4">
              <img src={URL.createObjectURL(file)} alt={file.name} className="max-h-20" />
              <button
                onClick={() => onRemove(index)}
                className="absolute top-1 right-1 z-10 bg-black rounded-full size-5 shadow-md hover:bg-gray-900 transition-colors flex items-center justify-center"
              >
                <div className="i-ph:x size-3 text-gray-200" />
              </button>
            </div>
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
