import { describe, expect, it } from 'vitest';
import { materializePageAction } from './materialize-page-action';

describe('materializePageAction', () => {
  it('should materialize patch text updates into html actions', () => {
    const result = materializePageAction(
      {
        id: 'hero-copy',
        action: 'update',
        pageName: 'index',
        contentKind: 'patch',
        content: '',
        domId: 'hero-copy',
        rootDomId: 'hero-copy',
        validRootDomId: false,
        patches: [
          {
            opId: 'set-copy',
            type: 'set-text',
            target: {
              domId: 'hero-copy',
            },
            text: '全新标题',
          },
        ],
      },
      '<section id="hero"><div id="hero-copy">旧标题</div></section>',
    );

    expect(result.action).toMatchObject({
      id: 'hero-copy',
      action: 'update',
      contentKind: 'html',
      domId: 'hero-copy',
      rootDomId: 'hero-copy',
      content: '<div id="hero-copy">全新标题</div>',
    });
    expect(result.nextPageContent).toContain('全新标题');
  });

  it('should materialize insert patch into add html action', () => {
    const result = materializePageAction(
      {
        id: 'hero-badge',
        action: 'add',
        pageName: 'index',
        contentKind: 'patch',
        content: '',
        domId: 'hero',
        rootDomId: 'hero-badge',
        validRootDomId: false,
        patches: [
          {
            opId: 'insert-badge',
            type: 'insert-node',
            parentDomId: 'hero',
            html: '<span id="hero-badge">New</span>',
            position: 'append',
          },
        ],
      },
      '<section id="hero"><div id="hero-copy">旧标题</div></section>',
    );

    expect(result.action).toMatchObject({
      action: 'add',
      contentKind: 'html',
      domId: 'hero',
      rootDomId: 'hero-badge',
      content: '<span id="hero-badge">New</span>',
    });
    expect(result.nextPageContent).toContain('<span id="hero-badge">New</span>');
  });

  it('should keep insert-node idempotent when the same root id already exists', () => {
    const result = materializePageAction(
      {
        id: 'main-content',
        action: 'update',
        pageName: 'index',
        contentKind: 'patch',
        content: '',
        domId: 'main-content',
        rootDomId: 'main-content',
        validRootDomId: false,
        patches: [
          {
            opId: 'add-button',
            type: 'insert-node',
            parentDomId: 'main-content',
            html: '<button id="simple-btn">点击我</button>',
            position: 'append',
          },
        ],
      },
      '<section id="main-content"><p id="copy">这是一行简单的文本。</p><button id="simple-btn">点击</button></section>',
    );

    expect(result.nextPageContent).toBe(
      '<section id="main-content"><p id="copy">这是一行简单的文本。</p><button id="simple-btn">点击我</button></section>',
    );
    expect(result.nextPageContent.match(/id="simple-btn"/g)).toHaveLength(1);
  });

  it('should materialize remove-node patch against the updated root block', () => {
    const result = materializePageAction(
      {
        id: 'update-index-nav',
        action: 'update',
        pageName: 'index',
        contentKind: 'patch',
        content: '',
        domId: 'index-nav',
        rootDomId: 'index-nav',
        validRootDomId: true,
        patches: [
          {
            opId: 'patch-nav-links',
            type: 'remove-node',
            target: {
              domId: 'index-nav-links',
            },
          },
        ],
      },
      '<nav id="index-nav"><ul id="nav-list"><li id="index-nav-links">About</li><li id="services-link">Services</li></ul></nav>',
    );

    expect(result.action).toMatchObject({
      id: 'update-index-nav',
      action: 'update',
      contentKind: 'html',
      domId: 'index-nav',
      rootDomId: 'index-nav',
      content: '<nav id="index-nav"><ul id="nav-list"><li id="services-link">Services</li></ul></nav>',
    });
    expect(result.nextPageContent).not.toContain('index-nav-links');
  });
});
