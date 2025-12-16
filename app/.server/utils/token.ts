import type { UIMessage, UIMessagePart } from 'ai';
import { Tiktoken } from 'js-tiktoken/lite';
import o200k_base from 'js-tiktoken/ranks/o200k_base';

const tiktoken = new Tiktoken(o200k_base);

export function encode(text: string) {
  return tiktoken.encode(text);
}

export function decode(tokens: number[]) {
  return tiktoken.decode(tokens);
}

export function approximatePromptTokenCount(messages: UIMessage[]): number {
  return messages.reduce((acc, message) => {
    return acc + approximateUsageFromContent(message.parts || []);
  }, 0);
}

export function approximateUsageFromContent(parts: Array<UIMessagePart<any, any>>): number {
  let totalLength = 0;

  for (const part of parts) {
    if (part.type === 'text') {
      totalLength += encode(part.text).length;
    }

    if (part.type === 'reasoning') {
      totalLength += encode(part.text).length;
    }
  }
  return totalLength;
}
