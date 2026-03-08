/**
 * lib/monitoring/index.ts
 *
 * Structured Sentry error tracking for BodiX business-critical paths.
 * Each function attaches domain-specific tags and safe extra context so
 * Sentry issues are grouped and searchable by feature, user, and operation.
 *
 * Privacy rules applied here:
 *   - Phone numbers → only last 4 digits logged
 *   - User IDs → logged (UUIDs; not personally identifiable on their own)
 *   - Payment amounts → logged (needed for incident investigation)
 *   - No email, full name, or message content is ever logged
 */

import * as Sentry from '@sentry/nextjs'

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
  Sentry.captureException(error, {
    tags: {
      feature: 'check-in',
      mode: context.mode,
    },
    extra: {
      userId: context.userId,
      enrollmentId: context.enrollmentId,
      dayNumber: context.dayNumber,
    },
  })
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
  Sentry.captureException(error, {
    tags: {
      feature: 'payment',
      payment_method: context.paymentMethod,
      program: context.programSlug,
    },
    extra: {
      userId: context.userId,
      programSlug: context.programSlug,
      amountVnd: context.amount,
      // Reference ID is safe: internal ID only, not a card/bank number
      referenceId: context.referenceId,
    },
  })
}

// ─── Zalo ZNS ─────────────────────────────────────────────────────────────────

export function trackZaloAPIError(
  error: unknown,
  context: {
    userId: string
    nudgeType: string
    templateId?: string
    phone?: string       // full phone passed in — only suffix logged
    enrollmentId?: string
  },
): void {
  Sentry.captureException(error, {
    tags: {
      feature: 'zalo',
      nudge_type: context.nudgeType,
    },
    extra: {
      userId: context.userId,
      enrollmentId: context.enrollmentId,
      templateId: context.templateId,
      // Log only last 4 digits to correlate with Zalo delivery logs without
      // storing a full phone number in Sentry.
      phoneSuffix: context.phone ? `****${context.phone.slice(-4)}` : undefined,
    },
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
  Sentry.captureException(error, {
    tags: {
      feature: 'rescue',
      trigger_reason: context.triggerReason,
      action: context.actionTaken,
    },
    extra: {
      enrollmentId: context.enrollmentId,
      userId: context.userId,
      riskScore: context.riskScore,
      daysSinceLast: context.daysSinceLast,
    },
  })
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
  Sentry.captureException(error, {
    tags: {
      feature: 'edge-function',
      function_name: context.functionName,
    },
    extra: {
      batchOffset: context.batchOffset,
      enrollmentCount: context.enrollmentCount,
    },
  })
}
