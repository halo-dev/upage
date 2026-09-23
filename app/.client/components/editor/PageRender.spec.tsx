import { act, render, waitFor } from '@testing-library/react';
import { createRef, forwardRef, useEffect, useImperativeHandle } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { DocumentProperties } from '~/types/editor';
import { PageRender, type PageRenderRef } from './PageRender';

vi.mock('react-frame-component', () => ({
  default: forwardRef<
    HTMLIFrameElement,
    {
      children?: React.ReactNode;
      contentDidMount?: () => void;
    }
  >(({ children, contentDidMount }, ref) => {
    useImperativeHandle(
      ref,
      () =>
        ({
          contentDocument: document,
          contentWindow: window,
          style: document.createElement('iframe').style,
        }) as unknown as HTMLIFrameElement,
      [],
    );

    useEffect(() => {
      contentDidMount?.();
    }, [contentDidMount]);

    return <div id="page-content">{children}</div>;
  }),
}));

vi.mock('./EditorOverlay', () => ({
  EditorOverlay: () => null,
}));

describe('PageRender', () => {
  it('preserves the live page snapshot across a controlled frame refresh', async () => {
    const pageRef = createRef<PageRenderRef>();
    const onUpdate = vi.fn();
    const documentProperties: DocumentProperties = {
      name: 'index',
      title: '首页',
      head: '',
      content:
        '<main id="main"><h1 id="hero-title">旧标题</h1><script id="interactions">window.version = 1;</script></main>',
    };

    render(<PageRender ref={pageRef} document={documentProperties} isCurrentPage onUpdate={onUpdate} />);

    await waitFor(() => {
      expect(pageRef.current?.element?.querySelector('[id="hero-title"]')?.textContent).toBe('旧标题');
    });

    act(() => {
      const pageElement = pageRef.current?.element;
      const title = pageElement?.querySelector('[id="hero-title"]');
      const script = pageElement?.querySelector('[id="interactions"]');
      if (title) {
        title.textContent = '当前会话中的新标题';
      }
      if (script) {
        script.textContent = 'window.version = 2;';
      }
      pageRef.current?.refresh();
    });

    await waitFor(() => {
      expect(pageRef.current?.element?.querySelector('[id="hero-title"]')?.textContent).toBe('当前会话中的新标题');
      expect(pageRef.current?.element?.querySelector('[id="interactions"]')?.textContent).toContain(
        'window.version = 2;',
      );
    });

    expect(onUpdate).toHaveBeenCalledWith('index', expect.stringContaining('当前会话中的新标题'));
  });
});
