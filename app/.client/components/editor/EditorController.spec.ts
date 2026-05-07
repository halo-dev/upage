import { describe, expect, it } from 'vitest';
import { EditorController } from './EditorController';

describe('EditorController', () => {
  it('should replace existing nodes when the id contains CSS special characters', () => {
    const pageElement = document.createElement('div');
    pageElement.innerHTML = '<section id="main"><div id="hero:copy">旧内容</div></section>';

    const controller = new EditorController({
      getContentElement: () => pageElement,
      getIframeElement: () => null,
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
    });

    controller.updateContent('#hero-copy', '<div id="hero-copy">新内容</div>', 0);

    const main = pageElement.querySelector('[id="main"]');
    expect(pageElement.querySelectorAll('[id="hero-copy"]')).toHaveLength(1);
    expect(main?.children[0]?.id).toBe('hero-copy');
    expect(main?.children[0]?.textContent).toBe('新内容');
  });
});
