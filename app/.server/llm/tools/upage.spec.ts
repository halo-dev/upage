import { describe, expect, it, vi } from 'vitest';
import { createUPageTool, extractRootElementId, upageInputSchema } from './upage';

describe('createUPageTool', () => {
  it('should emit every structured page payload', async () => {
    const onPage = vi.fn();
    const tool = createUPageTool(onPage);

    const result = await tool.execute?.(
      {
        pages: [
          {
            artifact: {
              id: 'home-page',
              name: 'index',
              title: '首页',
            },
            actions: [
              {
                id: 'hero-section',
                action: 'add',
                pageName: 'index',
                contentKind: 'html',
                content: '<section id="hero-root"></section>',
                domId: 'page-index',
                rootDomId: 'hero-root',
                sort: 0,
                validRootDomId: true,
              },
            ],
            summary: '新增首页首屏',
          },
        ],
      } as never,
      {} as never,
    );

    expect(onPage).toHaveBeenCalledTimes(1);
    expect(onPage).toHaveBeenCalledWith(
      expect.objectContaining({
        artifact: expect.objectContaining({ name: 'index' }),
      }),
    );
    expect(result).toEqual({
      pages: [
        {
          artifact: {
            id: 'home-page',
            name: 'index',
            title: '首页',
          },
          actions: [
            {
              id: 'hero-section',
              action: 'add',
              pageName: 'index',
              contentKind: 'html',
              content: '<section id="hero-root"></section>',
              domId: 'page-index',
              rootDomId: 'hero-root',
              sort: 0,
              validRootDomId: true,
            },
          ],
          summary: '新增首页首屏',
        },
      ],
      emittedPages: ['index'],
      pageCount: 1,
    });
  });

  it('should normalize legacy page sections input', async () => {
    const onPage = vi.fn();
    const tool = createUPageTool(onPage);

    const result = await tool.execute?.(
      {
        pages: [
          {
            id: 'index',
            name: 'index',
            title: '首页',
            sections: [
              {
                nodeId: 'hero',
                html: '<section id="hero"></section>',
                css: '',
                js: '',
              },
            ],
          },
        ],
      } as never,
      {} as never,
    );

    expect(onPage).toHaveBeenCalledWith({
      artifact: {
        id: 'index',
        name: 'index',
        title: '首页',
      },
      actions: [
        {
          id: 'hero',
          action: 'add',
          pageName: 'index',
          contentKind: 'html',
          content: '<section id="hero"></section>',
          domId: 'main',
          rootDomId: 'hero',
          sort: 0,
          validRootDomId: true,
        },
      ],
    });
    expect(result).toEqual({
      pages: [
        {
          artifact: {
            id: 'index',
            name: 'index',
            title: '首页',
          },
          actions: [
            {
              id: 'hero',
              action: 'add',
              pageName: 'index',
              contentKind: 'html',
              content: '<section id="hero"></section>',
              domId: 'main',
              rootDomId: 'hero',
              sort: 0,
              validRootDomId: true,
            },
          ],
        },
      ],
      emittedPages: ['index'],
      pageCount: 1,
    });
  });

  it('should extract root element id from structured content', () => {
    expect(extractRootElementId('<section id="hero-root"><h1 id="hero-title">Hello</h1></section>')).toBe('hero-root');
    expect(extractRootElementId('  <style id="page-style">body { color: red; }</style>')).toBe('page-style');
    expect(extractRootElementId('<section><div id="hero-title">Hello</div></section>')).toBeUndefined();
  });

  it('should support patch actions and preserve raw patch ops', async () => {
    const onPage = vi.fn();
    const tool = createUPageTool(onPage);

    const result = await tool.execute?.(
      {
        pages: [
          {
            artifact: {
              id: 'home-page',
              name: 'index',
              title: '首页',
            },
            actions: [
              {
                id: 'hero-copy',
                action: 'update',
                pageName: 'index',
                contentKind: 'patch',
                content: '',
                domId: 'hero-copy',
                rootDomId: 'hero-copy',
                patches: [
                  {
                    opId: 'set-copy-text',
                    type: 'set-text',
                    target: {
                      domId: 'hero-copy',
                    },
                    text: '全新标题',
                  },
                ],
              },
            ],
          },
        ],
      } as never,
      {} as never,
    );

    if (!result || Symbol.asyncIterator in result) {
      throw new Error('Expected upage tool to return a plain result object.');
    }

    expect(result.pages[0]?.actions[0]).toMatchObject({
      id: 'hero-copy',
      contentKind: 'patch',
      patches: [
        {
          opId: 'set-copy-text',
          type: 'set-text',
          target: {
            domId: 'hero-copy',
          },
          text: '全新标题',
        },
      ],
    });
  });

  it('should reject structurally malformed patch ops instead of coercing them into removals', () => {
    const parsed = upageInputSchema.safeParse({
      pages: [
        {
          artifact: {
            id: 'home-page',
            name: 'index',
            title: '首页',
          },
          actions: [
            {
              id: 'update-index-nav',
              action: 'update',
              pageName: 'index',
              contentKind: 'patch',
              content: '',
              domId: 'index-nav',
              rootDomId: 'index-nav',
              patches: [
                {
                  type: 'set-attr',
                  opId: 'patch-nav-links',
                  target: {
                    domId: 'index-nav-links',
                  },
                },
              ],
            },
          ],
        },
      ],
    });

    expect(parsed.success).toBe(false);
  });

  it('should preserve valid set-attr patches', () => {
    const parsed = upageInputSchema.safeParse({
      pages: [
        {
          artifact: {
            id: 'home-page',
            name: 'index',
            title: '首页',
          },
          actions: [
            {
              id: 'update-theme',
              action: 'update',
              pageName: 'index',
              contentKind: 'patch',
              content: '',
              domId: 'index-nav',
              rootDomId: 'index-nav',
              patches: [
                {
                  type: 'set-attr',
                  opId: 'set-theme-class',
                  target: {
                    domId: 'index-nav',
                  },
                  name: 'class',
                  value: 'dark',
                },
              ],
            },
          ],
        },
      ],
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }

    expect(parsed.data.pages[0]?.actions[0]?.patches?.[0]).toMatchObject({
      type: 'set-attr',
      opId: 'set-theme-class',
      name: 'class',
      value: 'dark',
    });
  });

  it('should support remove-page patch actions', () => {
    const parsed = upageInputSchema.safeParse({
      pages: [
        {
          artifact: {
            id: 'pricing-page',
            name: 'pricing',
            title: '定价页',
          },
          actions: [
            {
              id: 'remove-pricing-page',
              action: 'remove',
              pageName: 'pricing',
              contentKind: 'patch',
              content: '',
              domId: '__page__',
              rootDomId: '__page__',
              patches: [
                {
                  type: 'remove-page',
                  opId: 'remove-pricing-page-op',
                },
              ],
            },
          ],
        },
      ],
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }

    expect(parsed.data.pages[0]?.actions[0]).toMatchObject({
      action: 'remove',
      contentKind: 'patch',
      patches: [
        {
          type: 'remove-page',
          opId: 'remove-pricing-page-op',
        },
      ],
    });
  });
});
