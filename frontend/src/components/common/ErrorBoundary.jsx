import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
          <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
            <AlertTriangle size={24} className="text-red-400" />
          </div>
          <h2 className="mb-1 text-base font-semibold text-gray-900 dark:text-gray-200">This screen hit a rendering error</h2>
          <p className="mb-5 max-w-md text-sm text-gray-500 dark:text-desk-muted">
            A component threw an exception. Your data is usually fine — reloading rebuilds the view. If this keeps
            happening, open the browser console and share the stack trace.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn-primary inline-flex items-center gap-2"
          >
            <RefreshCw size={14} aria-hidden="true" />
            Reload page
          </button>
          {import.meta.env.DEV && (
            <details className="mt-6 text-left max-w-lg">
              <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-400">
                Error details (dev only)
              </summary>
              <pre className="mt-2 text-xs text-red-400 bg-gray-900 p-3 rounded-lg overflow-auto max-h-40 border border-gray-800">
                {String(this.state.error)}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
