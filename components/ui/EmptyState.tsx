"use client";

import { ReactNode } from "react";

interface EmptyStateProps {
  illustration?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ illustration, title, description, action, className = "" }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-neutral-200 bg-white p-12 text-center ${className}`}
    >
      {illustration && (
        <div className="mb-4 text-6xl opacity-60" aria-hidden="true">
          {illustration}
        </div>
      )}
      {!illustration && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 text-3xl" aria-hidden="true">
          📭
        </div>
      )}
      <h3 className="font-heading text-lg font-semibold text-neutral-800">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-sm text-neutral-600">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
