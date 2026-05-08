import { atom } from 'nanostores';
import type { TemplateReference } from '~/types/chat';
import type { UPageMessageMetadata } from '~/types/message';

export type SendChatMessageParams = {
  messageContent: string;
  files: File[];
  metadata?: UPageMessageMetadata;
  templateReference?: TemplateReference;
};

export type SendChatMessageFunction = (params: SendChatMessageParams) => Promise<void>;

export const sendChatMessageStore = atom<SendChatMessageFunction | null>(null);

export function setSendChatMessage(fn: SendChatMessageFunction) {
  sendChatMessageStore.set(fn);
}

export function clearSendChatMessage() {
  sendChatMessageStore.set(null);
}
