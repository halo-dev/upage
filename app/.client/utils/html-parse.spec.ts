import { describe, expect, it } from 'vitest';
import { isScriptContent, isValidContent } from './html-parse';

describe('html-parse', () => {
  describe('isScriptContent', () => {
    it('应该识别 script 标签内容', () => {
      expect(isScriptContent('<script id="test">console.log("hello")</script>')).toBe(true);
      expect(isScriptContent('  <script id="test">console.log("hello")</script>')).toBe(true);
    });

    it('应该不识别非 script 标签内容', () => {
      expect(isScriptContent('<div id="test">hello</div>')).toBe(false);
      expect(isScriptContent('<style id="test">body { color: red; }</style>')).toBe(false);
      expect(isScriptContent('hello world')).toBe(false);
    });
  });

  describe('isValidContent - 有效的 HTML 内容', () => {
    it('应该接受根节点完整且有 id 的 HTML（内部元素可不完整）', () => {
      expect(isValidContent('<section id="xxxx"><div>h')).toBe(true);
      expect(isValidContent('<section id="xxxx"><div>hello')).toBe(true);
      expect(isValidContent('<section id="xxxx"><div>hello world</div>')).toBe(true);
      expect(isValidContent('<section id="xxxx">hello world')).toBe(true);
      expect(isValidContent('<section id="xxxx">hello world</br>')).toBe(true);
    });

    it('应该接受完整的 HTML 元素', () => {
      expect(isValidContent('<div id="root"></div>')).toBe(true);
      expect(isValidContent('<div id="root">content</div>')).toBe(true);
      expect(isValidContent('<section id="main"><h1>Title</h1></section>')).toBe(true);
    });

    it('应该接受带有多个属性的根元素', () => {
      expect(isValidContent('<div id="root" class="container">content</div>')).toBe(true);
      expect(isValidContent('<div class="container" id="root" data-test="value">content</div>')).toBe(true);
    });

    it('应该接受使用单引号的 id 属性', () => {
      expect(isValidContent("<div id='root'>content</div>")).toBe(true);
      expect(isValidContent("<div id='root' class='container'>content</div>")).toBe(true);
    });
  });

  describe('isValidContent - 无效的 HTML 内容', () => {
    it('应该拒绝根节点不完整的 HTML', () => {
      expect(isValidContent('<div')).toBe(false);
      expect(isValidContent('<div id="xx')).toBe(false);
      expect(isValidContent('<div id="xxxx"><div>hello world</d')).toBe(false);
      expect(isValidContent('<div id="xxxx"><div>hello world</div')).toBe(false);
    });

    it('应该拒绝缺少 id 属性的根元素', () => {
      expect(isValidContent('<div>content</div>')).toBe(false);
      expect(isValidContent('<div class="container">content</div>')).toBe(false);
    });

    it('应该拒绝 id 属性不完整的根元素', () => {
      expect(isValidContent('<div id=')).toBe(false);
      expect(isValidContent('<div id="')).toBe(false);
      expect(isValidContent('<div id="root')).toBe(false);
    });

    it('应该拒绝末尾有不完整标签的内容', () => {
      expect(isValidContent('<div id="root">content</')).toBe(false);
      expect(isValidContent('<div id="root">content</d')).toBe(false);
      expect(isValidContent('<div id="root">content</di')).toBe(false);
    });

    it('应该拒绝末尾有孤立 < 字符的内容', () => {
      expect(isValidContent('<div id="xxxx"><div>hello world<')).toBe(false);
      expect(isValidContent('<div id="root">content<')).toBe(false);
      expect(isValidContent('<div id="test"><span>test<')).toBe(false);
    });

    it('应该接受 < 作为普通字符后跟完整闭合标签的内容', () => {
      expect(isValidContent('<div id="xxxx"><div>hello world<</div>')).toBe(true);
      expect(isValidContent('<div id="root">5 < 10</div>')).toBe(true);
      expect(isValidContent('<div id="test"><span>a<b</span></div>')).toBe(true);
    });
  });

  describe('isValidContent - 有效的 script 内容', () => {
    it('应该接受完整的 script 标签', () => {
      expect(isValidContent('<script id="test">console.log("hello");</script>')).toBe(true);
      expect(isValidContent('<script id="test"></script>')).toBe(true);
      expect(isValidContent('<script id="main" type="text/javascript">alert("test");</script>')).toBe(true);
    });

    it('应该接受使用单引号的 script 标签', () => {
      expect(isValidContent("<script id='test'>console.log('hello');</script>")).toBe(true);
    });

    it('应该接受带有多行代码的 script 标签', () => {
      const content = `<script id="test">
function hello() {
  console.log("world");
}
hello();
</script>`;
      expect(isValidContent(content)).toBe(true);
    });
  });

  describe('isValidContent - 无效的 script 内容', () => {
    it('应该拒绝没有 id 的 script 标签', () => {
      expect(isValidContent('<script>console.log("hello");</script>')).toBe(false);
    });

    it('应该拒绝没有闭合标签的 script', () => {
      expect(isValidContent('<script id="test">console.log("hello");')).toBe(false);
      expect(isValidContent('<script id="test">console.log("hello");</scrip')).toBe(false);
      expect(isValidContent('<script id="test">console.log("hello");</script')).toBe(false);
    });

    it('应该拒绝 script 开始标签不完整', () => {
      expect(isValidContent('<script id="test"')).toBe(false);
      expect(isValidContent('<script id="test')).toBe(false);
      expect(isValidContent('<script id=')).toBe(false);
    });

    it('应该拒绝 id 属性不完整的 script 标签', () => {
      expect(isValidContent('<script id="test>console.log("hello");</script>')).toBe(false);
      expect(isValidContent('<script id=test>console.log("hello");</script>')).toBe(false);
    });

    it('应该拒绝末尾有孤立 < 字符的 script 内容', () => {
      expect(isValidContent('<script id="test">console.log("hello")<')).toBe(false);
      expect(isValidContent('<script id="test">var a = 5<')).toBe(false);
    });

    it('应该接受 script 中 < 作为普通字符后跟完整闭合标签', () => {
      expect(isValidContent('<script id="test">if (5 < 10) { console.log("yes"); }</script>')).toBe(true);
      expect(isValidContent('<script id="test">var a = b < c;</script>')).toBe(true);
    });
  });

  describe('isValidContent - 有效的 style 内容', () => {
    it('应该接受完整的 style 标签', () => {
      expect(isValidContent('<style id="test">body { color: red; }</style>')).toBe(true);
      expect(isValidContent('<style id="test"></style>')).toBe(true);
      expect(isValidContent('<style id="main" type="text/css">.class { margin: 0; }</style>')).toBe(true);
    });

    it('应该接受使用单引号的 style 标签', () => {
      expect(isValidContent("<style id='test'>body { color: red; }</style>")).toBe(true);
    });

    it('应该接受带有多行样式的 style 标签', () => {
      const content = `<style id="test">
body {
  margin: 0;
  padding: 0;
}
.container {
  width: 100%;
}
</style>`;
      expect(isValidContent(content)).toBe(true);
    });
  });

  describe('isValidContent - 无效的 style 内容', () => {
    it('应该拒绝没有 id 的 style 标签', () => {
      expect(isValidContent('<style>body { color: red; }</style>')).toBe(false);
    });

    it('应该拒绝没有闭合标签的 style', () => {
      expect(isValidContent('<style id="test">body { color: red; }')).toBe(false);
      expect(isValidContent('<style id="test">body { color: red; }</styl')).toBe(false);
      expect(isValidContent('<style id="test">body { color: red; }</style')).toBe(false);
    });

    it('应该拒绝 style 开始标签不完整', () => {
      expect(isValidContent('<style id="test"')).toBe(false);
      expect(isValidContent('<style id="test')).toBe(false);
      expect(isValidContent('<style id=')).toBe(false);
    });

    it('应该拒绝 id 属性不完整的 style 标签', () => {
      expect(isValidContent('<style id="test>body { color: red; }</style>')).toBe(false);
      expect(isValidContent('<style id=test>body { color: red; }</style>')).toBe(false);
    });

    it('应该拒绝末尾有孤立 < 字符的 style 内容', () => {
      expect(isValidContent('<style id="test">body { color: red; }<')).toBe(false);
      expect(isValidContent('<style id="test">.class { margin: 0; }<')).toBe(false);
    });

    it('应该接受 style 中 < 作为普通字符后跟完整闭合标签', () => {
      expect(isValidContent('<style id="test">/* comment < test */ body { color: red; }</style>')).toBe(true);
    });
  });

  describe('isValidContent - 边界情况', () => {
    it('应该拒绝空字符串', () => {
      expect(isValidContent('')).toBe(false);
    });

    it('应该拒绝只有空格的字符串', () => {
      expect(isValidContent('   ')).toBe(false);
    });

    it('应该拒绝 null 和 undefined', () => {
      expect(isValidContent(null as any)).toBe(false);
      expect(isValidContent(undefined as any)).toBe(false);
    });

    it('应该拒绝非字符串类型', () => {
      expect(isValidContent(123 as any)).toBe(false);
      expect(isValidContent({} as any)).toBe(false);
      expect(isValidContent([] as any)).toBe(false);
    });

    it('应该拒绝纯文本内容（不是标签）', () => {
      expect(isValidContent('hello world')).toBe(false);
    });

    it('应该接受带有前导空格的有效内容', () => {
      expect(isValidContent('  <div id="root">content</div>')).toBe(true);
      expect(isValidContent('  <script id="test">console.log("hello");</script>')).toBe(true);
      expect(isValidContent('  <style id="test">body { color: red; }</style>')).toBe(true);
    });
  });
});
