import { atom } from 'nanostores';
import type { ExportEditorFile } from './web-builder';

export interface PreviewInfo {
  content: string;
  filename: string;
  mimeType: string;
}

// 当页面保存时，由 save 方法主动调用并 setPreviews 来更新 previews 中的数据
export class PreviewsStore {
  previews = atom<PreviewInfo[]>([]);
  currentPreview = atom<string | null>(null);

  setPreviews(files: ExportEditorFile[]) {
    this.previews.set(
      files.map((file) => ({
        content: file.content,
        filename: file.filename,
        mimeType: file.mimeType,
      })),
    );
  }

  setCurrentPreview(filename: string) {
    this.currentPreview.set(filename);
  }
}

// Create a singleton instance
let previewsStore: PreviewsStore | null = null;

export function usePreviewStore() {
  if (!previewsStore) {
    previewsStore = new PreviewsStore();
  }

  return previewsStore;
}
