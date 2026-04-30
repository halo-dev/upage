import { describe, expect, it, vi } from 'vitest';
import { consumeStreamTextFullStream, createStreamTextUIMessageWriter } from './ui-message-stream';

describe('ui-message-stream', () => {
  it('should normalize fullStream chunks and accumulate text', async () => {
    const events: unknown[] = [];

    const text = await consumeStreamTextFullStream({
      fullStream: createFullStream([
        { type: 'reasoning-start', id: 'reasoning-1' },
        { type: 'reasoning-delta', id: 'reasoning-1', text: '先分析结构。' },
        { type: 'reasoning-end', id: 'reasoning-1' },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', text: 'Hello ' },
        { type: 'text-delta', id: 'text-1', text: 'World' },
        { type: 'text-end', id: 'text-1' },
      ]),
      onEvent: (event) => {
        events.push(event);
      },
    });

    expect(text).toBe('Hello World');
    expect(events).toEqual([
      { chunk: { type: 'reasoning-start', id: 'reasoning-1' }, text: '' },
      { chunk: { type: 'reasoning-delta', id: 'reasoning-1', delta: '先分析结构。' }, text: '' },
      { chunk: { type: 'reasoning-end', id: 'reasoning-1' }, text: '' },
      { chunk: { type: 'text-start', id: 'text-1' }, text: '' },
      { chunk: { type: 'text-delta', id: 'text-1', text: 'Hello ' }, text: 'Hello ' },
      { chunk: { type: 'text-delta', id: 'text-1', text: 'World' }, text: 'Hello World' },
      { chunk: { type: 'text-end', id: 'text-1' }, text: 'Hello World' },
    ]);
  });

  it('should write normalized chunks into a ui message stream', () => {
    const writer = {
      write: vi.fn(),
      merge: vi.fn(),
      onError: undefined,
    };
    const writeEvent = createStreamTextUIMessageWriter({
      writer,
      idPrefix: 'design-md-1',
    });

    writeEvent({
      chunk: { type: 'reasoning-start', id: 'reasoning-1' },
      text: '',
    });
    writeEvent({
      chunk: { type: 'reasoning-delta', id: 'reasoning-1', delta: '先分析结构。' },
      text: '',
    });
    writeEvent({
      chunk: { type: 'text-start', id: 'text-1' },
      text: '',
    });
    writeEvent({
      chunk: { type: 'text-delta', id: 'text-1', text: 'Hello' },
      text: 'Hello',
    });
    writeEvent({
      chunk: { type: 'text-end', id: 'text-1' },
      text: 'Hello',
    });

    expect(writer.write).toHaveBeenCalledTimes(5);
    expect(writer.write).toHaveBeenNthCalledWith(1, { type: 'reasoning-start', id: 'design-md-1-reasoning-1' });
    expect(writer.write).toHaveBeenNthCalledWith(2, {
      type: 'reasoning-delta',
      id: 'design-md-1-reasoning-1',
      delta: '先分析结构。',
    });
    expect(writer.write).toHaveBeenNthCalledWith(3, { type: 'text-start', id: 'design-md-1-text-1' });
    expect(writer.write).toHaveBeenNthCalledWith(4, { type: 'text-delta', id: 'design-md-1-text-1', delta: 'Hello' });
    expect(writer.write).toHaveBeenNthCalledWith(5, { type: 'text-end', id: 'design-md-1-text-1' });
  });
});

async function* createFullStream(chunks: unknown[]) {
  for (const chunk of chunks) {
    yield chunk;
  }
}
