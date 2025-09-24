/**
 * UPageArtifactData 是 UPage 的 artifact 类型，由 AI 返回的结构化数据。
 * 最终对应 editor 的 Page 数据。
 */
export interface UPageArtifactData {
  // artifact id，唯一
  id: string;
  // 页面名称，最终渲染为页面文件名，如 `index.html`，不包含后缀。唯一
  name: string;
  // 页面标题，最终渲染为页面标题
  title: string;
}
