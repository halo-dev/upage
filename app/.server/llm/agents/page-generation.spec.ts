import { describe, expect, it } from 'vitest';
import { appendPageSummaryContext, buildPageGenerationSystemPrompt, createElementEditPrompt } from './page-generation';

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

describe('buildPageGenerationSystemPrompt', () => {
  it('should require primary content to stay visible without script', () => {
    const prompt = buildPageGenerationSystemPrompt({
      summary: '',
      pageSummaryOutline: '',
      pageSummaryDetailed: '',
      context: {},
      designMd: '# Design System',
    });

    expect(prompt).toContain('页面在没有任何 Script 执行时也必须可正常预览');
    expect(prompt).toContain('不能依赖脚本在稍后把主要内容从隐藏切换为显示');
    expect(prompt).toContain('不要把首屏、正文主体、关键信息卡片、主要 CTA 做成');
  });

  it('should include template reference context only when provided', () => {
    const prompt = buildPageGenerationSystemPrompt({
      summary: '',
      pageSummaryOutline: '',
      pageSummaryDetailed: '',
      context: {},
      designMd: '# Design System',
      templateReferenceAnalysis: '参考模板：SaaS Landing Page',
      templateReferenceHtmlSnippets: '<section><h1>Hero</h1></section>',
    });

    expect(prompt).toContain('TEMPLATE REFERENCE');
    expect(prompt).toContain('参考模板：SaaS Landing Page');
    expect(prompt).toContain('TEMPLATE HTML SNIPPETS');
    expect(prompt).toContain('<section><h1>Hero</h1></section>');
  });

  it('should omit template reference block when not provided', () => {
    const prompt = buildPageGenerationSystemPrompt({
      summary: '',
      pageSummaryOutline: '',
      pageSummaryDetailed: '',
      context: {},
      designMd: '# Design System',
    });

    expect(prompt).not.toContain('TEMPLATE REFERENCE');
  });
});
