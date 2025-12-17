import { useEffect, useState } from 'react';
import { useFetcher } from 'react-router';
import { toast } from 'sonner';

// 定义错误响应的类型
interface AuthErrorResponse {
  errorMessage?: string;
}

/**
 * 认证错误提示组件
 *
 * 这个组件检测认证过程中的错误，并使用 toast 显示错误消息
 */
export function AuthErrorToast() {
  // 使用 fetcher 从服务器获取错误信息
  const fetcher = useFetcher<AuthErrorResponse>();
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    // 只在组件首次加载时检查一次错误
    if (!hasChecked) {
      fetcher.load('/api/auth/check-error');
      setHasChecked(true);
    }
  }, [fetcher, hasChecked]);

  useEffect(() => {
    // 当 fetcher 获取到数据时，如果有错误信息则显示
    if (fetcher.data?.errorMessage) {
      toast.error(fetcher.data.errorMessage);
    }
  }, [fetcher.data]);

  // 这是一个无形的组件，不渲染任何内容
  return null;
}
