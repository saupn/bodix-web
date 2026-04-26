/**
 * lib/monitoring/index.ts
 *
 * Structured error tracking for BodiX business-critical paths.
 * Each function logs domain-specific context to the console (server logs / Vercel Log Drain).
 *
 * Privacy rules applied here:
 *   - Phone numbers → only last 4 digits logged
 *   - User IDs → logged (UUIDs; not personally identifiable on their own)
 *   - Payment amounts → logged (needed for incident investigation)
 *   - No email, full name, or message content is ever logged
 */

// ─── Check-in ─────────────────────────────────────────────────────────────────

export function trackCheckInError(
  error: unknown,
  context: {
    userId: string
    enrollmentId: string
    dayNumber: number
    mode: 'hard' | 'light' | 'recovery' | 'skip'
  },
): void {
  console.error('[check-in]', error, context)
}

// ─── Payment ──────────────────────────────────────────────────────────────────

export function trackPaymentError(
  error: unknown,
  context: {
    userId: string
    programSlug: string
    paymentMethod: string
    amount?: number
    referenceId?: string
  },
): void {
  console.error('[payment]', error, context)
}

// ─── Zalo ZNS ─────────────────────────────────────────────────────────────────

export function trackZaloAPIError(
  error: unknown,
  context: {
    userId: string
    nudgeType: string
    templateId?: string
    phone?: string       // full phone passed in – only suffix logged
    enrollmentId?: string
  },
): void {
  console.error('[zalo]', error, {
    ...context,
    phoneSuffix: context.phone ? `****${context.phone.slice(-4)}` : undefined,
    phone: undefined,
  })
}

// ─── Rescue system ────────────────────────────────────────────────────────────

export function trackRescueFailure(
  error: unknown,
  context: {
    enrollmentId: string
    userId: string
    triggerReason: string
    actionTaken: string
    riskScore?: number
    daysSinceLast?: number
  },
): void {
  console.error('[rescue]', error, context)
}

// ─── Generic boundary for Edge Functions ─────────────────────────────────────

export function trackEdgeFunctionError(
  error: unknown,
  context: {
    functionName: string
    batchOffset?: number
    enrollmentCount?: number
  },
): void {
  console.error('[edge-function]', error, context)
}
