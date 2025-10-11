import { atom } from 'nanostores';
import type { UPageMessageMetadata } from '~/types/message';

export type SendChatMessageParams = {
  messageContent: string;
  files: File[];
  metadata?: UPageMessageMetadata;
};

export type SendChatMessageFunction = (params: SendChatMessageParams) => Promise<void>;

export const sendChatMessageStore = atom<SendChatMessageFunction | null>(null);

export function setSendChatMessage(fn: SendChatMessageFunction) {
  sendChatMessageStore.set(fn);
}
