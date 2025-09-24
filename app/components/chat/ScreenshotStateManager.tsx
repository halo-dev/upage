import { useEffect } from 'react';

interface ScreenshotStateManagerProps {
  setUploadFiles?: (files: File[]) => void;
  uploadFiles: File[];
}

export const ScreenshotStateManager = ({ setUploadFiles, uploadFiles }: ScreenshotStateManagerProps) => {
  useEffect(() => {
    if (setUploadFiles) {
      (window as any).__UPAGE_SET_UPLOADED_FILES__ = setUploadFiles;
      (window as any).__UPAGE_UPLOADED_FILES__ = uploadFiles;
    }

    return () => {
      delete (window as any).__UPAGE_SET_UPLOADED_FILES__;
      delete (window as any).__UPAGE_UPLOADED_FILES__;
    };
  }, [setUploadFiles, uploadFiles]);

  return null;
};
