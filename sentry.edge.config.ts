// sentry.edge.config.ts
// Loaded for middleware and routes running in the Vercel Edge runtime.
// Registered via instrumentation.ts → process.env.NEXT_RUNTIME === 'edge'
// Note: Replay integration is NOT available in Edge runtime.

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: 0.1,

  sendDefaultPii: false,

  enabled: process.env.NODE_ENV === 'production',

  environment: process.env.NODE_ENV,
})
