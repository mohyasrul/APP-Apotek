import { Component, ErrorInfo, ReactNode } from 'react';
import { Warning } from '@phosphor-icons/react';
import * as Sentry from '@sentry/react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
    Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
          <div className="bg-white p-8 rounded-3xl shadow-soft border border-gray-100 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center mx-auto mb-6">
              <Warning weight="fill" className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Terjadi Kesalahan</h2>
            <p className="text-sm text-gray-500 mb-6">
              Aplikasi mengalami error yang tidak terduga. Silakan coba muat ulang halaman.
            </p>
            <p className="text-xs text-gray-400 mb-6 bg-gray-50 p-3 rounded-xl break-all font-mono">
              {this.state.error?.message}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-3 rounded-xl transition-all shadow-[0_4px_12px_rgba(59,130,246,0.3)]"
            >
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
