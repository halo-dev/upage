import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EditorPatch } from '~/.client/stores/pages';
import type { Editor } from '~/types/editor';
import { EditorStudio } from './Editor';

const { editorCalls, mockEditor } = vi.hoisted(() => {
  const calls: string[] = [];
  const editor: Editor = {
    appendContent: vi.fn((query: string) => {
      calls.push(`append:${query}`);
    }),
    updateContent: vi.fn(),
    deleteContent: vi.fn(),
    getContent: vi.fn(() => ''),
    setContent: vi.fn(),
    scrollToElement: vi.fn((query: string) => {
      calls.push(`scroll:${query}`);
    }),
  };

  return {
    editorCalls: calls,
    mockEditor: editor,
  };
});

vi.mock('~/.client/persistence', () => ({
  useChatHistory: () => null,
}));

vi.mock('./EditorComponent', () => ({
  EditorComponent: ({ onReady }: { onReady?: (editor: Editor) => void }) => {
    onReady?.(mockEditor);
    return <div data-testid="editor-component" />;
  },
}));

describe('EditorStudio', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    editorCalls.length = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should acknowledge a queued patch only after the throttled editor update runs', () => {
    const onPatchApplied = vi.fn((patchId: string) => {
      editorCalls.push(`ack:${patchId}`);
    });

    const firstPatch: EditorPatch = {
      id: 'patch-1',
      messageId: 'message-1',
      artifactId: 'artifact-1',
      actionId: 'action-1',
      source: 'data-upage-page',
      streaming: true,
      action: {
        id: 'action-1',
        action: 'add',
        pageName: 'index',
        content: '<section id="hero-root">Hello</section>',
        domId: 'main',
        rootDomId: 'hero-root',
        sort: 0,
      },
    };

    const secondPatch: EditorPatch = {
      ...firstPatch,
      id: 'patch-2',
      actionId: 'action-2',
      action: {
        ...firstPatch.action,
        id: 'action-2',
        content: '<section id="hero-root">Updated</section>',
      },
    };

    const { rerender } = render(<EditorStudio currentPatch={firstPatch} onPatchApplied={onPatchApplied} />);

    expect(onPatchApplied).toHaveBeenCalledWith('patch-1');
    expect(editorCalls).toEqual(['scroll:#hero-root', 'append:#main', 'ack:patch-1']);

    onPatchApplied.mockClear();
    editorCalls.length = 0;

    rerender(<EditorStudio currentPatch={secondPatch} onPatchApplied={onPatchApplied} />);

    expect(onPatchApplied).not.toHaveBeenCalled();
    expect(editorCalls).toEqual([]);

    act(() => {
      vi.advanceTimersByTime(149);
    });

    expect(onPatchApplied).not.toHaveBeenCalled();
    expect(editorCalls).toEqual([]);

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(onPatchApplied).toHaveBeenCalledWith('patch-2');
    expect(editorCalls).toEqual(['scroll:#hero-root', 'append:#main', 'ack:patch-2']);
  });
});
