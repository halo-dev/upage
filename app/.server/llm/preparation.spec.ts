import { describe, expect, it } from 'vitest';
import {
  buildContextFromPages,
  buildPageSelectionCandidates,
  buildSnapshotDetailedContent,
  buildSnapshotOutlineContent,
  resolveSelectedPages,
} from './preparation';

describe('preparation helpers', () => {
  const pages = [
    {
      id: 'page-1',
      messageId: 'message-1',
      name: 'index',
      title: '首页',
      content: '<main><h1>首页</h1><section>欢迎来到产品首页。</section></main>',
      actionIds: ['action-1'],
    },
    {
      id: 'page-2',
      messageId: 'message-1',
      name: 'pricing',
      title: '定价页',
      content: '<main><h1>定价</h1><section>基础版与专业版价格说明。</section></main>',
      actionIds: [],
    },
    {
      id: 'page-3',
      messageId: 'message-1',
      name: 'contact',
      title: '联系页',
      content: '<main><h1>联系</h1><form><input name="email" /></form></main>',
      actionIds: [],
    },
  ];

  it('should build lightweight selection candidates', () => {
    const candidates = buildPageSelectionCandidates(pages);

    expect(candidates).toHaveLength(3);
    expect(candidates[0]).toMatchObject({
      name: 'index',
      title: '首页',
      actionCount: 1,
    });
    expect(candidates[0]?.preview).toContain('首页');
  });

  it('should resolve selected pages with fallback limit', () => {
    expect(resolveSelectedPages(pages, ['pricing']).map((page) => page.name)).toEqual(['pricing']);
    expect(resolveSelectedPages(pages, []).map((page) => page.name)).toEqual(['index', 'pricing', 'contact']);
  });

  it('should preserve the selected page order returned by the model', () => {
    expect(resolveSelectedPages(pages, ['contact', 'index']).map((page) => page.name)).toEqual(['contact', 'index']);
  });

  it('should build prompt context sections from selected pages', () => {
    const context = buildContextFromPages([pages[0]]);

    expect(context.index?.pageTitle).toBe('首页');
    expect(context.index?.sections[0]).toContain('<main>');
  });

  it('should build lightweight outline snapshot content', () => {
    const outline = buildSnapshotOutlineContent({
      ...pages[0],
      content:
        '<main><section id="hero"><h1>首页</h1><button>立即开始</button></section><script>console.log(1)</script></main>',
    });

    expect(outline).toContain('页面标题：首页');
    expect(outline).toContain('主要结构：main、section#hero');
    expect(outline).toContain('主要标题：首页');
    expect(outline).not.toContain('console.log');
  });

  it('should build focused detailed snapshot content without scripts', () => {
    const detailed = buildSnapshotDetailedContent({
      ...pages[2],
      content: '<main><form id="contact-form"><input name="email" /></form><script>alert(1)</script></main>',
    });

    expect(detailed).toContain('页面内容片段');
    expect(detailed).toContain('<form id="contact-form">');
    expect(detailed).not.toContain('alert(1)');
  });
});
