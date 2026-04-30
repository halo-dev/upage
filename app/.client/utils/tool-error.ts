export function formatToolError(toolName: string, errorText?: string) {
  if (!errorText) {
    return undefined;
  }

  if (toolName === 'upage') {
    return formatUpageToolError(errorText);
  }

  return errorText;
}

function formatUpageToolError(errorText: string) {
  if (!errorText.includes('Invalid input for tool upage')) {
    return errorText;
  }

  if (errorText.includes('"set-attr"') && errorText.includes('"name"') && errorText.includes('"value"')) {
    return '页面变更校验失败：删除节点时请使用 remove-node，不要用 set-attr。';
  }

  if (errorText.includes('"replace-node"') && errorText.includes('"html"')) {
    return '页面变更校验失败：删除节点时请使用 remove-node，不要用 replace-node。';
  }

  return '页面变更校验失败：提交的页面 patch 不符合 upage 结构。';
}
