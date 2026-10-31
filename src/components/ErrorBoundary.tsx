import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  /** Tên vùng bị bao, hiển thị trong thông báo lỗi và log (vd. "Khung nhìn 3D"). */
  label?: string;
  /** Khi true, chỉ phủ lên vùng cha (absolute) thay vì toàn màn hình. */
  inline?: boolean;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary:${this.props.label ?? 'app'}]`, error, info.componentStack);
  }

  private handleRetry = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const { label = 'Ứng dụng', inline = false } = this.props;
    return (
      <div
        role="alert"
        data-testid="error-boundary-fallback"
        className={`${inline ? 'absolute inset-0' : 'fixed inset-0'} z-40 flex items-center justify-center p-6 bg-[#0f1722]/95 text-slate-100`}
      >
        <div className="max-w-md w-full rounded-2xl border border-rose-500/50 bg-[#111927] p-5 shadow-2xl">
          <div className="flex items-center gap-2 text-rose-300 font-bold">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span>{label} gặp lỗi</span>
          </div>
          <p className="mt-2 text-xs text-slate-300 break-words font-mono">{error.message}</p>
          <p className="mt-2 text-xs text-slate-400">
            Thao tác gần nhất có thể chưa được lưu. Bạn có thể thử lại, hoặc tải lại trang nếu lỗi lặp lại.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={this.handleRetry}
              className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Thử lại
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-3 py-1.5 rounded-xl border border-slate-600 text-slate-200 text-xs font-medium hover:bg-slate-800 cursor-pointer"
            >
              Tải lại trang
            </button>
          </div>
        </div>
      </div>
    );
  }
}
