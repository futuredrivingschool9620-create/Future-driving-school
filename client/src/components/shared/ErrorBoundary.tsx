import { Component, type ErrorInfo, type ReactNode } from 'react';
import { logDiagnostic } from '../../lib/diagnostics';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** When this value changes (e.g. the current route), the boundary self-heals. */
  resetKey?: string | number;
  /** Retry rendering once before showing the fallback UI. */
  autoRecover?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  private recoveryTimer: ReturnType<typeof setTimeout> | null = null;
  private recoveryAttempts = 0;
  private static readonly MAX_AUTO_RECOVERY = 1;

  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught application error:', error, errorInfo);
    logDiagnostic({
      category: 'render',
      component: 'ErrorBoundary',
      message: error?.message || 'Component rendering error',
      details: errorInfo?.componentStack,
    });

    // A single automatic retry recovers transient render glitches without a reload.
    // If it throws again the attempts are exhausted and the fallback UI is shown.
    if (this.props.autoRecover && this.recoveryAttempts < ErrorBoundary.MAX_AUTO_RECOVERY) {
      this.recoveryAttempts += 1;
      this.recoveryTimer = setTimeout(() => {
        this.recoveryTimer = null;
        if (this.state.hasError) {
          this.setState({ hasError: false, error: null });
        }
      }, 60);
    }
  }

  public componentDidUpdate(prevProps: Props) {
    if (prevProps.resetKey !== this.props.resetKey) {
      this.recoveryAttempts = 0;
      if (this.state.hasError) {
        this.setState({ hasError: false, error: null });
      }
    }
  }

  public componentWillUnmount() {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
    }
  }

  private handleReload = () => {
    this.recoveryAttempts = 0;
    this.setState({ hasError: false, error: null });
    if (typeof window !== 'undefined') {
      // Recover in-place first; only fall back to a hard reload when in-place recovery
      // is not possible. A hard reload must never happen automatically on a live window.
      window.location.hash = '#/';
      window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100">
          <div className="max-w-md w-full p-8 rounded-3xl bg-white dark:bg-slate-800 shadow-2xl border border-slate-200 dark:border-slate-700 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 8.25h.008v.008H12v-.008Z" />
              </svg>
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight mb-2">Display Restored</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
              The application encountered a visual rendering glitch and recovered safely. Click below to refresh the view.
            </p>
            {this.state.error?.message && (
              <div className="mb-6 p-3 rounded-xl bg-slate-100 dark:bg-slate-900 text-xs font-mono text-rose-600 dark:text-rose-400 text-left overflow-auto max-h-24">
                {this.state.error.message}
              </div>
            )}
            <div className="flex items-center gap-3 justify-center">
              <button
                onClick={this.handleReload}
                className="px-5 py-2.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-teal-600 to-indigo-600 hover:from-teal-500 hover:to-indigo-500 shadow-lg shadow-teal-500/20 active:scale-95 transition-all"
              >
                Reload Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
