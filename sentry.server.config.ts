// sentry.server.config.ts
// Loaded by Next.js for every server-side request (Node.js runtime).
// Registered via instrumentation.ts → process.env.NEXT_RUNTIME === 'nodejs'

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  tracesSampleRate: 0.1,

  sendDefaultPii: false,

  enabled: process.env.NODE_ENV === 'production',

  environment: process.env.NODE_ENV,

  // Log unhandled promise rejections from Edge Functions / API routes
  integrations: [Sentry.captureConsoleIntegration({ levels: ['error'] })],
})
