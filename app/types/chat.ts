import type { Chat, Message, Page, Section } from '@prisma/client';

export type ChatMessage = Message & {
  sections: Section[];
  page: Page;
};

export type ChatWithMessages = Chat & {
  messages: ChatMessage[];
};
