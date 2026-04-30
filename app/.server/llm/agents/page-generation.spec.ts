import { describe, expect, it } from 'vitest';
import { appendPageSummaryContext, createElementEditPrompt } from './page-generation';

describe('createElementEditPrompt', () => {
  it('should pin update scope to the selected domId', () => {
    const prompt = createElementEditPrompt({
      tagName: 'div',
      className: 'hero-copy highlighted',
      id: 'hero-copy',
      domId: 'hero-copy',
      outerHTML: '<div id="hero-copy"><span id="hero-copy-text">Hello</span></div>',
    });

    expect(prompt).toContain('优先更新目标 domId: hero-copy');
    expect(prompt).toContain('update/remove 的 patch target 必须使用这个 domId');
    expect(prompt).toContain('不要把修改范围扩大到整个 section、header、footer 或更大的祖先块');
    expect(prompt).toContain('<div id="hero-copy"><span id="hero-copy-text">Hello</span></div>');
  });
});

describe('appendPageSummaryContext', () => {
  it('should append outline and detailed page summaries separately', () => {
    const prompt = appendPageSummaryContext('BASE', {
      pageSummaryOutline: '<snapshot_outline>outline</snapshot_outline>',
      pageSummaryDetailed: '<snapshot_detailed>detailed</snapshot_detailed>',
    });

    expect(prompt).toContain('PAGE SUMMARY OUTLINE');
    expect(prompt).toContain('<snapshot_outline>outline</snapshot_outline>');
    expect(prompt).toContain('PAGE SUMMARY DETAILED');
    expect(prompt).toContain('<snapshot_detailed>detailed</snapshot_detailed>');
  });
});
