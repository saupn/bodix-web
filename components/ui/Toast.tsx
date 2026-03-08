"use client";

import { useEffect, createContext, useContext, useState, useCallback, ReactNode } from "react";

type ToastVariant = "success" | "error" | "info" | "warning";

interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      toast: (m: string) => {},
      success: (m: string) => {},
      error: (m: string) => {},
      info: (m: string) => {},
      warning: (m: string) => {},
    };
  }
  return ctx;
}

const variantStyles: Record<ToastVariant, string> = {
  success: "bg-success/95 text-white border-success",
  error: "bg-red-600 text-white border-red-700",
  info: "bg-primary text-secondary-light border-primary-dark",
  warning: "bg-amber-500 text-white border-amber-600",
};

const variantIcons: Record<ToastVariant, string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
  warning: "⚠",
};

const DURATION_MS = 5000;

function ToastItemComp({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, DURATION_MS);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg transition-all duration-300 ${variantStyles[item.variant]}`}
    >
      <span className="text-lg" aria-hidden="true">
        {variantIcons[item.variant]}
      </span>
      <p className="flex-1 text-sm font-medium">{item.message}</p>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, variant: ToastVariant = "info") => {
    const id = Math.random().toString(36).slice(2);
    setItems((prev) => [...prev, { id, message, variant }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const value: ToastContextValue = {
    toast: addToast,
    success: (m) => addToast(m, "success"),
    error: (m) => addToast(m, "error"),
    info: (m) => addToast(m, "info"),
    warning: (m) => addToast(m, "warning"),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed bottom-4 left-4 right-4 z-[100] mx-auto flex max-w-md flex-col gap-2 sm:left-auto sm:right-4"
        aria-label="Thông báo"
      >
        {items.map((item) => (
          <ToastItemComp key={item.id} item={item} onDismiss={() => removeToast(item.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Legacy single Toast for backward compatibility */
interface LegacyToastProps {
  message: string;
  open: boolean;
  onClose: () => void;
  durationMs?: number;
  variant?: ToastVariant;
}

export function Toast({ message, open, onClose, durationMs = 5000, variant = "info" }: LegacyToastProps) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, durationMs);
    return () => clearTimeout(t);
  }, [open, durationMs, onClose]);

  if (!open) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`fixed bottom-4 left-4 right-4 z-[100] mx-auto flex max-w-md items-center gap-3 rounded-lg border px-4 py-3 shadow-lg sm:left-auto sm:right-4 ${variantStyles[variant]}`}
    >
      <span className="text-lg" aria-hidden="true">
        {variantIcons[variant]}
      </span>
      <p className="flex-1 text-sm font-medium">{message}</p>
    </div>
  );
}
