import { executeScript } from '~/.client/utils/execute-scripts';
import { isScriptContent } from '~/.client/utils/html-parse';
import type { Editor, EditorControllerProps, ScrollToElementOptions } from '~/types/editor';

export class EditorController implements Editor {
  private props: EditorControllerProps;

  constructor(props: EditorControllerProps) {
    this.props = props;
  }

  setContent(newHTML: string) {
    const pageElement = this.props.getContentElement();
    if (!pageElement) {
      return;
    }
    pageElement.innerHTML = newHTML;
  }

  replaceWith(query: string, newHTML: string, sort?: number) {
    const pageElement = this.props.getContentElement();
    if (!pageElement) {
      return;
    }

    const targetElement = pageElement.querySelector(query);
    if (!targetElement) {
      return;
    }

    targetElement.outerHTML = newHTML;
    if (sort === undefined) {
      return;
    }

    const parent = targetElement.parentElement;
    if (!parent) {
      return;
    }

    const children = Array.from(parent.children);
    const index = children.indexOf(targetElement);
    if (index === -1) {
      return;
    }

    if (sort !== index) {
      parent.insertBefore(targetElement, children[sort]);
    }
  }

  /**
   * 在指定节点下追加 HTML
   * @param query 查询条件，待添加元素的父节点 ID。
   * @param newHTML 新 HTML
   * @param sort 排序位置，从 0 开始表示应该处于第一位，2 表示应该处于第二位，以此类推。不填写则表示默认或者不变
   */
  append(query: string, newHTML: string, sort?: number) {
    const pageElement = this.props.getContentElement();
    if (!pageElement) {
      return;
    }

    const targetElement = pageElement.querySelector(query);
    const parent = targetElement || pageElement;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = newHTML;
    const newElement = tempDiv.firstElementChild as HTMLElement;
    if (!newElement) {
      return;
    }

    if (sort === undefined) {
      parent.appendChild(newElement);
    } else {
      parent.insertBefore(newElement, parent.children[sort]);
    }
  }

  appendContent(query: string, newHTML: string, sort?: number) {
    const pageElement = this.props.getContentElement();
    if (!pageElement) {
      return;
    }
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = newHTML;
    const newElement = tempDiv.firstElementChild as HTMLElement;
    if (!newElement) {
      return;
    }
    const id = newElement.id;
    const targetElement = pageElement.querySelector(`#${id}`);
    if (targetElement) {
      this.replaceWith(`#${id}`, newHTML, sort);
      if (isScriptContent(newHTML)) {
        this.refresh();
      }
      return;
    }
    this.append(query, newHTML, sort);
    const element = pageElement.querySelector(`#${id}`);
    if (element instanceof HTMLScriptElement) {
      executeScript(element);
      const frameRef = this.props.getIframeElement();
      const event = new Event('DOMContentLoaded', {
        bubbles: true,
        cancelable: true,
      });
      frameRef?.contentDocument?.dispatchEvent(event);
    }
  }

  updateContent(query: string, newHTML: string, sort?: number) {
    const pageElement = this.props.getContentElement();
    if (!pageElement) {
      return;
    }
    this.replaceWith(query, newHTML, sort);
    if (isScriptContent(newHTML)) {
      this.refresh();
    }
  }

  deleteContent(query: string) {
    const pageElement = this.props.getContentElement();
    if (!pageElement) {
      return;
    }

    const targetElement = pageElement.querySelector(query);
    if (targetElement) {
      targetElement.remove();
    }
    if (targetElement instanceof HTMLScriptElement) {
      this.refresh();
    }
  }

  getContent(query?: string): string {
    const pageElement = this.props.getContentElement();
    if (!pageElement) {
      return '';
    }

    if (query) {
      const targetElement = pageElement.querySelector(query);
      return targetElement ? targetElement.innerHTML : '';
    }

    return pageElement.innerHTML;
  }

  scrollToElement(query: string, options?: ScrollToElementOptions) {
    const pageElement = this.props.getContentElement();
    if (!pageElement) {
      return;
    }

    const autoScrollEnabled = this.props.getAutoScrollEnabled?.() ?? true;
    if (!options?.force && !autoScrollEnabled) {
      return;
    }

    const targetElement = pageElement.querySelector(query);
    const scrollContainer = pageElement.parentElement;
    if (targetElement instanceof HTMLElement && scrollContainer instanceof HTMLElement) {
      const containerRect = scrollContainer.getBoundingClientRect();
      const targetRect = targetElement.getBoundingClientRect();
      const verticalPadding = Math.min(containerRect.height * 0.2, 120);
      const alreadyInComfortZone =
        targetRect.top >= containerRect.top + verticalPadding &&
        targetRect.bottom <= containerRect.bottom - verticalPadding;

      if (!options?.force && alreadyInComfortZone) {
        return;
      }

      const nextScrollTop =
        scrollContainer.scrollTop +
        (targetRect.top - containerRect.top) -
        containerRect.height / 2 +
        targetRect.height / 2;

      scrollContainer.scrollTo({
        top: Math.max(0, nextScrollTop),
        behavior: options?.force ? 'smooth' : 'auto',
      });
    }
  }

  refresh() {
    const iframeElement = this.props.getIframeElement();
    if (!iframeElement) {
      return;
    }
    iframeElement.contentWindow?.location.reload();
  }
}
