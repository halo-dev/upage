import { atom, computed } from 'nanostores';
import type { EditorDocuments } from './editor';

export interface PreviewInfo {
  name: string;
  title: string;
  head: string;
  content: string;
}

// 当页面保存时，由 save 方法主动调用并 setPreviews 来更新 previews 中的数据
export class PreviewsStore {
  previews = atom<PreviewInfo[]>([]);
  currentPreviewName = atom<string | null>(null);
  currentPreview = computed([this.previews, this.currentPreviewName], (previews, currentPreviewName) => {
    return previews.find((preview) => preview.name === currentPreviewName);
  });

  setPreviews(documents: EditorDocuments) {
    this.previews.set(
      Object.values(documents).map((document) => ({
        name: document.name,
        title: document.title,
        head: document.head,
        content: document.content,
      })),
    );
  }

  setCurrentPreviewName(name: string) {
    this.currentPreviewName.set(name);
  }
}

let previewsStore: PreviewsStore | null = null;

export function usePreviewStore() {
  if (!previewsStore) {
    previewsStore = new PreviewsStore();
  }

  return previewsStore;
}
