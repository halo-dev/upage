import type { ErrorInfo, ReactNode } from 'react';
import { Component } from 'react';
import { toast } from 'sonner';
import { logger } from '~/utils/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * 错误边界组件
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // 更新状态，下次渲染时显示降级 UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // 记录错误信息
    logger.error('组件错误边界捕获到错误:', { error, errorInfo });

    // 显示错误提示
    toast.error(`组件发生错误: ${error.message}`);

    // 调用可选的 onError 回调
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // 如果提供了自定义的降级 UI，则使用它
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 默认的降级 UI
      return (
        <div className="p-4 border border-red-300 bg-red-50 rounded-md">
          <h3 className="text-red-800 font-medium mb-2">组件加载失败</h3>
          <p className="text-red-600 text-sm mb-2">{this.state.error?.message || '发生了未知错误'}</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-3 py-1 bg-red-100 text-red-800 rounded text-sm hover:bg-red-200"
          >
            重试
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
