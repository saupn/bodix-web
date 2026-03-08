"use client";

interface ErrorCardProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorCard({ message = "Đã có lỗi", onRetry, className = "" }: ErrorCardProps) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 p-8 text-center ${className}`}
    >
      <span className="text-4xl" aria-hidden="true">
        ⚠️
      </span>
      <p className="mt-3 text-sm font-medium text-red-800">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 min-h-[44px] min-w-[44px] rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-transform hover:scale-105 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          aria-label="Thử lại"
        >
          Thử lại
        </button>
      )}
    </div>
  );
}
