import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ThoughtBox from './ThoughtBox';

describe('ThoughtBox', () => {
  it('should stop auto scroll as soon as the user starts scrolling inside the thought box', () => {
    const { rerender } = render(
      <ThoughtBox title="思考过程" isRunning>
        <div>第一段内容</div>
      </ThoughtBox>,
    );

    const content = screen.getByText('第一段内容').parentElement as HTMLDivElement;

    Object.defineProperty(content, 'clientHeight', {
      configurable: true,
      value: 100,
    });
    Object.defineProperty(content, 'scrollHeight', {
      configurable: true,
      value: 400,
    });
    Object.defineProperty(content, 'scrollTop', {
      configurable: true,
      value: 300,
      writable: true,
    });

    fireEvent.wheel(content);

    content.scrollTop = 120;

    Object.defineProperty(content, 'scrollHeight', {
      configurable: true,
      value: 520,
    });

    rerender(
      <ThoughtBox title="思考过程" isRunning>
        <div>第一段内容，补充了更多推理细节。</div>
      </ThoughtBox>,
    );

    expect(content.scrollTop).toBe(120);
  });
});
