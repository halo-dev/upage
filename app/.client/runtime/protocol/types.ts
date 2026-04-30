import type { UPageAction } from '~/types/actions';
import type { UPageArtifactData } from '~/types/artifact';

export type PageChangeSource =
  | 'tool-upage-output'
  | 'tool-upage-input'
  | 'data-upage-page'
  | 'data-upage-block-start'
  | 'legacy-xml';

export type PageArtifactOpenEvent = {
  type: 'artifact-open';
  messageId: string;
  artifact: UPageArtifactData;
  source: PageChangeSource;
};

export type PageArtifactCloseEvent = {
  type: 'artifact-close';
  messageId: string;
  artifact: UPageArtifactData;
  source: PageChangeSource;
};

export type PageActionEvent = {
  type: 'action';
  messageId: string;
  artifactId: string;
  actionId: string;
  action: UPageAction;
  source: PageChangeSource;
  streaming?: boolean;
};

export type PageChangeEvent = PageArtifactOpenEvent | PageArtifactCloseEvent | PageActionEvent;
