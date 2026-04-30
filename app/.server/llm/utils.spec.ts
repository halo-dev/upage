import { describe, expect, it } from 'vitest';
import { extractMessageTextForPrompt } from './utils';

describe('llm utils', () => {
  it('should append structured page summaries to prompt text', () => {
    const text = extractMessageTextForPrompt({
      parts: [
        {
          type: 'text',
          text: '我已经处理好了首页。',
        },
        {
          type: 'data-upage-page',
          data: {
            artifact: {
              id: 'home-page',
              name: 'index',
              title: '首页',
            },
            actions: [
              {
                id: 'hero-update',
                action: 'update',
                pageName: 'index',
                content: '<section id="hero-root"></section>',
                domId: 'hero-root',
                rootDomId: 'hero-root',
                validRootDomId: true,
              },
            ],
          },
        },
      ],
    });

    expect(text).toContain('我已经处理好了首页。');
    expect(text).toBe('我已经处理好了首页。');
  });

  it('should ignore structured page parts without text', () => {
    const text = extractMessageTextForPrompt({
      parts: [
        {
          type: 'data-upage-page',
          data: {
            artifact: {
              id: 'about-page',
              name: 'about',
              title: '关于我们',
            },
            actions: [
              {
                id: 'about-hero',
                action: 'add',
                pageName: 'about',
                content: '<section id="about-hero"></section>',
                domId: 'page-about',
                rootDomId: 'about-hero',
                validRootDomId: true,
              },
            ],
          },
        },
      ],
    });

    expect(text).toBe('');
  });

  it('should ignore tool-upage input parts before tool completion', () => {
    const text = extractMessageTextForPrompt({
      parts: [
        {
          type: 'tool-upage',
          toolCallId: 'tool-upage-running',
          state: 'input-available',
          input: {
            pages: [
              {
                artifact: {
                  id: 'contact-page',
                  name: 'contact',
                  title: '联系页',
                },
                actions: [
                  {
                    id: 'contact-form',
                    action: 'add',
                    pageName: 'contact',
                    content: '<section id="contact-form"></section>',
                    domId: 'page-contact',
                    rootDomId: 'contact-form',
                    validRootDomId: true,
                  },
                ],
              },
            ],
          },
        },
      ],
    });

    expect(text).toBe('');
  });
});
