import type { Chat, Message, Page, PageV2, Section } from '@prisma/client';

export type ChatMetadata = {
  gitUrl?: string;
  gitBranch?: string;
  netlifySiteId?: string;
  designMd?: string;
  sessionType?: 'chat' | 'agent-page-builder';
};

export type ChatMessage = Message & {
  sections: Section[];
  page: Page[];
  pagesV2: PageV2[];
};

export type ChatWithMessages = Omit<Chat, 'metadata'> & {
  metadata: ChatMetadata | null;
  messages: ChatMessage[];
};
