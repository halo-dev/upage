import type { UIMessage, UIMessageStreamWriter } from 'ai';
import { throwIfAborted } from './abort';

export type StreamTextUIChunk =
  | {
      type: 'text-start' | 'text-end' | 'reasoning-start' | 'reasoning-end';
      id: string;
    }
  | {
      type: 'text-delta';
      id: string;
      text: string;
    }
  | {
      type: 'reasoning-delta';
      id: string;
      delta: string;
    };

export type StreamTextUIEvent = {
  chunk: StreamTextUIChunk;
  text: string;
};

export async function consumeStreamTextFullStream({
  fullStream,
  abortSignal,
  onEvent,
}: {
  fullStream: AsyncIterable<unknown>;
  abortSignal?: AbortSignal;
  onEvent?: (event: StreamTextUIEvent) => void;
}) {
  let text = '';

  for await (const rawChunk of fullStream) {
    throwIfAborted(abortSignal);

    const chunk = normalizeStreamTextUIChunk(rawChunk);
    if (!chunk) {
      continue;
    }

    if (chunk.type === 'text-delta') {
      text += chunk.text;
    }

    onEvent?.({
      chunk,
      text,
    });
  }

  return text;
}

export function createStreamTextUIMessageWriter<UI_MESSAGE extends UIMessage = UIMessage>({
  writer,
  idPrefix,
  onText,
}: {
  writer: UIMessageStreamWriter<UI_MESSAGE>;
  idPrefix?: string;
  onText?: (event: StreamTextUIEvent) => void;
}) {
  return (event: StreamTextUIEvent) => {
    const chunk = withPrefixedId(event.chunk, idPrefix);

    if (chunk.type === 'text-start' || chunk.type === 'text-end' || chunk.type === 'text-delta') {
      const nextEvent = {
        ...event,
        chunk,
      } satisfies StreamTextUIEvent;

      if (onText) {
        onText(nextEvent);
        return;
      }

      if (chunk.type === 'text-delta') {
        writer.write({
          type: 'text-delta',
          id: chunk.id,
          delta: chunk.text,
        });
        return;
      }

      writer.write({
        type: chunk.type,
        id: chunk.id,
      });
      return;
    }

    if (chunk.type === 'reasoning-delta') {
      writer.write({
        type: 'reasoning-delta',
        id: chunk.id,
        delta: chunk.delta,
      });
      return;
    }

    writer.write({
      type: chunk.type,
      id: chunk.id,
    });
  };
}

function normalizeStreamTextUIChunk(rawChunk: unknown): StreamTextUIChunk | undefined {
  if (typeof rawChunk !== 'object' || rawChunk === null || !('type' in rawChunk)) {
    return undefined;
  }

  const chunk = rawChunk as {
    type?: unknown;
    id?: unknown;
    text?: unknown;
  };

  if (typeof chunk.id !== 'string') {
    return undefined;
  }

  switch (chunk.type) {
    case 'text-start':
    case 'text-end':
    case 'reasoning-start':
    case 'reasoning-end':
      return {
        type: chunk.type,
        id: chunk.id,
      };
    case 'text-delta':
      if (typeof chunk.text !== 'string') {
        return undefined;
      }

      return {
        type: 'text-delta',
        id: chunk.id,
        text: chunk.text,
      };
    case 'reasoning-delta':
      if (typeof chunk.text !== 'string') {
        return undefined;
      }

      return {
        type: 'reasoning-delta',
        id: chunk.id,
        delta: chunk.text,
      };
    default:
      return undefined;
  }
}

function withPrefixedId(chunk: StreamTextUIChunk, idPrefix?: string): StreamTextUIChunk {
  if (!idPrefix) {
    return chunk;
  }

  const nextId = `${idPrefix}-${chunk.id}`;
  return {
    ...chunk,
    id: nextId,
  };
}
