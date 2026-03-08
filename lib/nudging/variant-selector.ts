import type { NudgeVariant } from './templates'

export interface SelectVariantOptions {
  /**
   * A/B test variant name for this nudge type (e.g. 'control', 'variant_a', 'variant_b').
   * When provided, the selected template index is stable per user+nudge rather than
   * rotating daily — so each user always sees the same "tone" within an A/B experiment.
   */
  abVariant?: string
  /**
   * ID of the variant sent to this user yesterday. Used to prevent the same
   * variant appearing two days in a row when multiple variants are available.
   */
  lastVariantId?: string
  /**
   * ISO date string (YYYY-MM-DD) representing "today".
   * Defaults to the current UTC date. Useful for testing.
   */
  date?: string
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Deterministic 32-bit integer hash of a string (djb2-style). */
function hashString(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i)
  }
  return Math.abs(hash >>> 0) // unsigned 32-bit
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Select a nudge variant for a given user.
 *
 * Selection strategy:
 *  - No A/B test  → rotate deterministically by hash(userId + date) % n,
 *                   then skip forward one slot if it matches yesterday's variant.
 *  - With A/B test → use hash(userId + nudgeType + abVariant) % n (stable across
 *                   days so the user always sees the same experiment bucket).
 */
export function selectVariant(
  nudgeType: string,
  userId: string,
  variants: NudgeVariant[],
  options: SelectVariantOptions = {}
): NudgeVariant {
  if (variants.length === 0) {
    throw new Error(`No variants provided for nudge type "${nudgeType}"`)
  }
  if (variants.length === 1) {
    return variants[0]
  }

  const { abVariant, lastVariantId, date } = options
  const today = date ?? todayUTC()

  let index: number

  if (abVariant) {
    // A/B mode: stable per user + experiment bucket (does not rotate daily)
    const seed = `${userId}:${nudgeType}:${abVariant}`
    index = hashString(seed) % variants.length
  } else {
    // Daily rotation mode: rotates each day
    const seed = `${userId}:${today}`
    index = hashString(seed) % variants.length

    // Avoid repeating yesterday's variant when there are enough options
    if (lastVariantId) {
      const yesterdaySeed = `${userId}:${shiftDate(today, -1)}`
      const yesterdayIndex = hashString(yesterdaySeed) % variants.length
      const lastSentMatchesYesterday = variants[yesterdayIndex].id === lastVariantId

      if (lastSentMatchesYesterday && index === yesterdayIndex) {
        index = (index + 1) % variants.length
      }
    }
  }

  return variants[index]
}
