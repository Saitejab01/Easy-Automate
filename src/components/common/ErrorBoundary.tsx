import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-4xl mx-auto my-8 bg-slate-900/90 border border-rose-500/30 rounded-2xl shadow-2xl animate-fadeIn">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-white">
                {this.props.fallbackTitle || 'An Unexpected Error Occurred'}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                The component encountered an unhandled issue while rendering. You can try refreshing this view.
              </p>

              {this.state.error && (
                <div className="mt-4 p-3 rounded-xl bg-slate-950 border border-slate-800 text-rose-300 font-mono text-xs overflow-x-auto whitespace-pre-wrap">
                  {this.state.error.message || String(this.state.error)}
                </div>
              )}

              {this.state.errorInfo?.componentStack && (
                <details className="mt-3 text-[11px] text-slate-500">
                  <summary className="cursor-pointer hover:text-slate-300 transition-colors font-mono">
                    View Component Stack Trace
                  </summary>
                  <pre className="mt-2 p-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 font-mono text-[10px] overflow-x-auto">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}

              <div className="mt-5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white transition-all shadow-md"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Reload Section</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

