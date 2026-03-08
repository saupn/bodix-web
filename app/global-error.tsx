'use client'

// global-error.tsx
// Error boundary for the root layout. Catches errors that escape all nested
// error.tsx boundaries (e.g. errors inside the root <html> shell).
// Must render its own <html> + <body> — layout is not available here.

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="vi">
      <body className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 p-6 text-center font-sans">
        <h1 className="text-2xl font-bold text-neutral-900">Có lỗi xảy ra</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Chúng tôi đã ghi nhận lỗi này. Vui lòng thử lại.
        </p>
        {error.digest && (
          <p className="mt-1 font-mono text-xs text-neutral-400">
            Error ID: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="mt-6 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          Thử lại
        </button>
      </body>
    </html>
  )
}
