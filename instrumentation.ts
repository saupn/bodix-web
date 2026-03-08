// instrumentation.ts
// Next.js instrumentation hook — runs once when the server starts.
// Registers Sentry for the appropriate runtime before any request is handled.
// Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

// Propagate Sentry trace context to fetch calls made from server components
export const onRequestError = async (
  err: unknown,
  request: { path: string; method: string },
  context: { routeType: string },
) => {
  const { captureRequestError } = await import('@sentry/nextjs')
  captureRequestError(err, request, context)
}
