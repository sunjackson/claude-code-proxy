/**
 * 错误边界组件
 * 捕获 React 组件树中的错误,防止整个应用崩溃
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // 更新 state 使下一次渲染显示降级 UI
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 记录错误到日志服务
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });

    // 可以将错误发送到错误报告服务
    // logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // 如果提供了自定义 fallback,使用它
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // 默认错误 UI
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-6">
          <div className="max-w-2xl w-full bg-gray-900 border border-red-500/30 rounded-lg p-8">
            {/* 错误图标 */}
            <div className="flex items-center justify-center mb-6">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
                <span className="text-4xl">⚠️</span>
              </div>
            </div>

            {/* 错误标题 */}
            <h1 className="text-2xl font-bold text-red-400 text-center mb-4">
              应用出现错误
            </h1>

            <p className="text-gray-400 text-center mb-6">
              抱歉,应用遇到了一个意外错误。请尝试刷新页面或联系技术支持。
            </p>

            {/* 错误详情 */}
            {this.state.error && (
              <div className="bg-black border border-gray-800 rounded-lg p-4 mb-6">
                <h3 className="text-sm font-semibold text-gray-300 mb-2">
                  错误信息:
                </h3>
                <pre className="text-xs text-red-400 overflow-x-auto">
                  {this.state.error.toString()}
                </pre>

                {this.state.errorInfo && (
                  <>
                    <h3 className="text-sm font-semibold text-gray-300 mt-4 mb-2">
                      堆栈跟踪:
                    </h3>
                    <pre className="text-xs text-gray-500 overflow-x-auto max-h-64">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </>
                )}
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={this.handleReset}
                className="px-6 py-3 bg-gray-800 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
              >
                重试
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-medium rounded-lg hover:from-amber-400 hover:to-amber-500 transition-colors"
              >
                刷新页面
              </button>
            </div>

            {/* 开发环境提示 */}
            {import.meta.env.DEV && (
              <div className="mt-6 pt-6 border-t border-gray-800">
                <p className="text-xs text-gray-500 text-center">
                  开发模式: 查看浏览器控制台获取更多详情
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * 函数式错误边界 Hook (React 18+)
 * 用于在函数组件中捕获错误
 */
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return setError;
}
