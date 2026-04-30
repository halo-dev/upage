export interface DocumentProperties {
  name: string;
  title: string;
  content: string;
  head: string;
}

export interface ScrollToElementOptions {
  force?: boolean;
}

export interface Editor {
  appendContent: (query: string, newHTML: string, sort?: number) => void;
  updateContent: (query: string, newHTML: string, sort?: number) => void;
  deleteContent: (query: string) => void;
  getContent: (query?: string) => string;
  setContent: (newHTML: string) => void;
  scrollToElement: (query: string, options?: ScrollToElementOptions) => void;
}

export interface EditorData {
  html?: string;
  element?: HTMLElement;
  query?: string;
}

export interface EditorControllerProps {
  getContentElement: () => HTMLElement | null;
  getIframeElement: () => HTMLIFrameElement | null;
  getAutoScrollEnabled?: () => boolean;
}
