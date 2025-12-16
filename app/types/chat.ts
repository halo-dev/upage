import type { Chat, Message, Page, PageV2, Section } from '@prisma/client';

export type ChatMessage = Message & {
  sections: Section[];
  page: Page[];
  pagesV2: PageV2[];
};

export type ChatWithMessages = Chat & {
  messages: ChatMessage[];
};
