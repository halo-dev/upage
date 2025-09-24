/**
 * 编辑器组件的通用接口
 */
export interface EditorProps {
  /**
   * 被编辑的元素
   */
  element: HTMLElement;

  /**
   * 发送请求到 AI
   * @param prompt 提示词
   * @returns
   */
  onSendPrompt: (prompt: string, element: HTMLElement) => Promise<void>;

  /**
   * 关闭编辑器的回调函数
   */
  onClose: () => void;

  /**
   * 元素类型
   */
  elementType: string;

  /**
   * 对话框标题
   */
  title?: string;
}
