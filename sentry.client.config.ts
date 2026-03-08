// sentry.client.config.ts
// Loaded by Next.js for every browser page load.
// Keep this file thin — heavy integrations should be lazy-imported.

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 10% of transactions sent to Sentry (enough for p95 latency analysis)
  tracesSampleRate: 0.1,

  // Session Replay: 1% of normal sessions, 10% of sessions with errors
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 0.1,

  integrations: [
    Sentry.replayIntegration({
      // Never record passwords, OTP codes, payment details
      maskAllText: false,
      maskAllInputs: true,
      blockAllMedia: false,
    }),
  ],

  // Never send cookies, IP addresses, or user PII by default
  sendDefaultPii: false,

  // Only send errors in production; suppress in development
  enabled: process.env.NODE_ENV === 'production',

  // Surface source-mapped frames in Sentry UI
  environment: process.env.NODE_ENV,
})
