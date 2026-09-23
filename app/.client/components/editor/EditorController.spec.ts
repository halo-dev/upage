import { describe, expect, it, vi } from 'vitest';
import { EditorController } from './EditorController';

describe('EditorController', () => {
  it('should replace existing nodes when the id contains CSS special characters', () => {
    const pageElement = document.createElement('div');
    pageElement.innerHTML = '<section id="main"><div id="hero:copy">旧内容</div></section>';

    const controller = new EditorController({
      getContentElement: () => pageElement,
      getIframeElement: () => null,
      refreshPage: vi.fn(),
    });

    controller.appendContent('#main', '<div id="hero:copy">新内容</div>');

    expect(pageElement.querySelectorAll('[id="hero:copy"]')).toHaveLength(1);
    expect(pageElement.querySelector('[id="hero:copy"]')?.outerHTML).toBe('<div id="hero:copy">新内容</div>');
  });

  it('should keep only the updated node when replacing with sort', () => {
    const pageElement = document.createElement('div');
    pageElement.innerHTML =
      '<section id="main"><div id="first">第一个</div><div id="hero-copy">旧内容</div><div id="last">最后一个</div></section>';

    const controller = new EditorController({
      getContentElement: () => pageElement,
      getIframeElement: () => null,
      refreshPage: vi.fn(),
    });

    controller.updateContent('#hero-copy', '<div id="hero-copy">新内容</div>', 0);

    const main = pageElement.querySelector('[id="main"]');
    expect(pageElement.querySelectorAll('[id="hero-copy"]')).toHaveLength(1);
    expect(main?.children[0]?.id).toBe('hero-copy');
    expect(main?.children[0]?.textContent).toBe('新内容');
  });

  it('should use a controlled frame refresh when updating a script', () => {
    const pageElement = document.createElement('div');
    pageElement.innerHTML =
      '<main id="main"><h1 id="hero-title">当前会话中的新标题</h1><script id="interactions">window.version = 1;</script></main>';
    const refreshPage = vi.fn();

    const controller = new EditorController({
      getContentElement: () => pageElement,
      getIframeElement: () => null,
      refreshPage,
    });

    controller.updateContent('#interactions', '<script id="interactions">window.version = 2;</script>');

    expect(pageElement.querySelector('[id="hero-title"]')?.textContent).toBe('当前会话中的新标题');
    expect(pageElement.querySelector('[id="interactions"]')?.textContent).toBe('window.version = 2;');
    expect(refreshPage).toHaveBeenCalledOnce();
  });
});
