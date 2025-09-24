import type { UIMessage } from 'ai';

export type UPageUIMessage = UIMessage<UPageMessageMetadata, UPageDataParts>;

export type ElementInfoMetadata = {
  tagName: string;
  className?: string;
  id?: string;
  innerHTML?: string;
  outerHTML?: string;
};

export type UPageMessageMetadata = {
  isHidden?: boolean;
  elementInfo?: ElementInfoMetadata;
};

// 自定义的 parts, 用于在前端显示进度条。
export type ProgressAnnotation = {
  label: string;
  status: 'in-progress' | 'complete' | 'stopped' | 'warning';
  order: number;
  message: string;
};

// 自定义的 parts, 用于在前端显示摘要。
export type SummaryAnnotation = {
  chatId: string;
  summary: string;
};

export type UPageDataParts = {
  progress: ProgressAnnotation;
  summary: SummaryAnnotation;
};
