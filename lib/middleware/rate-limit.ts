/**
 * lib/middleware/rate-limit.ts
 *
 * In-memory sliding-window rate limiter.
 * Works for single-instance Node.js (Vercel serverless warm instances).
 * For multi-instance or distributed deployments, replace with an
 * Upstash Redis-backed limiter (@upstash/ratelimit).
 *
 * NOTE: Does NOT work in Edge runtime (no persistent memory).
 *       Use only in Node.js API route handlers.
 */

import { NextResponse } from 'next/server'

interface Entry {
  count: number
  resetAt: number // epoch ms
}

const store = new Map<string, Entry>()

// Prune expired entries every 5 minutes to bound memory usage.
// .unref() lets the process exit cleanly in non-serverless environments.
const pruneInterval = setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key)
  }
}, 5 * 60_000)
if (typeof pruneInterval === 'object' && 'unref' in pruneInterval) {
  pruneInterval.unref()
}

function check(
  key: string,
  limit: number,
  windowMs: number,
): { ok: boolean; remaining: number; resetIn: number } {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: limit - 1, resetIn: windowMs }
  }

  if (entry.count >= limit) {
    return { ok: false, remaining: 0, resetIn: entry.resetAt - now }
  }

  entry.count++
  return { ok: true, remaining: limit - entry.count, resetIn: entry.resetAt - now }
}

// ─── Presets ──────────────────────────────────────────────────────────────────

/** Auth endpoints (send-otp, verify-otp, login): 10 req/min per IP. */
export function authRateLimit(ip: string) {
  return check(`auth:${ip}`, 10, 60_000)
}

/** Check-in endpoint: 20 req/min per authenticated user. */
export function checkinRateLimit(userId: string) {
  return check(`checkin:${userId}`, 20, 60_000)
}

/** General API endpoints: 60 req/min per IP. */
export function generalRateLimit(ip: string) {
  return check(`general:${ip}`, 60, 60_000)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract client IP from Next.js request headers.
 * Vercel sets x-real-ip; x-forwarded-for is a fallback.
 */
export function getClientIp(request: Request): string {
  const h = request.headers as Headers
  return (
    h.get('x-real-ip') ??
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    '0.0.0.0'
  )
}

/** Build a RFC-7231 compliant 429 response with rate limit headers. */
export function rateLimitExceeded(resetIn: number): NextResponse {
  return NextResponse.json(
    { error: 'Quá nhiều request. Vui lòng thử lại sau.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.ceil(resetIn / 1000)),
        'X-RateLimit-Reset': String(Math.ceil((Date.now() + resetIn) / 1000)),
      },
    },
  )
}
