import type { SupabaseClient } from '@supabase/supabase-js'
import { autoMatchCohort } from '@/lib/buddy/auto-match'

/**
 * Vòng đời cohort — chạy MỖI SÁNG trong cron `morning-messages`, TRƯỚC khi gửi
 * tin. KHÔNG thêm cron mới.
 *
 *   Bước 1  start_date <= hôm nay (VN) & status='upcoming'  → 'active'
 *           enrollments 'paid_waiting_cohort' trong đó       → 'active'
 *   Bước 2  end_date   <  hôm nay (VN) & status='active'    → 'completed'
 *           enrollments 'active' trong đó                    → 'completed'
 *
 * Mọi lỗi được nuốt + log: vòng đời cohort KHÔNG được chặn việc gửi tin sáng.
 */

export interface CohortLifecycleResult {
  activated_cohorts: number
  activated_enrollments: number
  completed_cohorts: number
  completed_enrollments: number
  errors: string[]
}

export async function runCohortLifecycle(
  service: SupabaseClient,
  todayVN: string,
): Promise<CohortLifecycleResult> {
  const result: CohortLifecycleResult = {
    activated_cohorts: 0,
    activated_enrollments: 0,
    completed_cohorts: 0,
    completed_enrollments: 0,
    errors: [],
  }

  // ── Bước 1: upcoming → active (đã tới ngày khai giảng) ───────────────────
  try {
    const { data: dueCohorts, error } = await service
      .from('cohorts')
      .select('id, name, start_date')
      .eq('status', 'upcoming')
      .lte('start_date', todayVN)

    if (error) throw new Error(error.message)

    for (const cohort of dueCohorts ?? []) {
      const { error: cohortErr } = await service
        .from('cohorts')
        .update({ status: 'active' })
        .eq('id', cohort.id)
        .eq('status', 'upcoming')

      if (cohortErr) {
        result.errors.push(`activate cohort ${cohort.id}: ${cohortErr.message}`)
        continue
      }
      result.activated_cohorts++

      const { data: waiting, error: waitErr } = await service
        .from('enrollments')
        .select('id')
        .eq('cohort_id', cohort.id)
        .eq('status', 'paid_waiting_cohort')

      if (waitErr) {
        result.errors.push(`fetch waiting ${cohort.id}: ${waitErr.message}`)
        continue
      }

      const n = waiting?.length ?? 0
      if (n > 0) {
        const { error: enrollErr } = await service
          .from('enrollments')
          .update({
            status: 'active',
            current_day: 0,
            started_at: cohort.start_date,
          })
          .eq('cohort_id', cohort.id)
          .eq('status', 'paid_waiting_cohort')

        if (enrollErr) {
          result.errors.push(`activate enrollments ${cohort.id}: ${enrollErr.message}`)
        } else {
          result.activated_enrollments += n
          await service
            .from('cohorts')
            .update({ current_members: n })
            .eq('id', cohort.id)
        }
      }

      // Ghép buddy — tự no-op khi app_settings.buddy_matching_enabled = false.
      try {
        await autoMatchCohort(service, cohort.id)
      } catch (err) {
        console.error('[cohort-lifecycle] buddy auto-match:', cohort.id, err)
      }

      console.log(
        '[cohort-lifecycle] activated cohort', cohort.id, cohort.name, '→', n, 'enrollments',
      )
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    result.errors.push(`step1: ${msg}`)
    console.error('[cohort-lifecycle] step1:', msg)
  }

  // ── Bước 2: active → completed (đã qua end_date) ─────────────────────────
  try {
    const { data: endedCohorts, error } = await service
      .from('cohorts')
      .select('id, name, end_date')
      .eq('status', 'active')
      .lt('end_date', todayVN)

    if (error) throw new Error(error.message)

    const nowIso = new Date().toISOString()

    for (const cohort of endedCohorts ?? []) {
      const { error: cohortErr } = await service
        .from('cohorts')
        .update({ status: 'completed' })
        .eq('id', cohort.id)
        .eq('status', 'active')

      if (cohortErr) {
        result.errors.push(`complete cohort ${cohort.id}: ${cohortErr.message}`)
        continue
      }
      result.completed_cohorts++

      // Founder đã chốt: enrollment 'active' trong cohort đã hết hạn → 'completed'.
      const { data: stillActive, error: activeErr } = await service
        .from('enrollments')
        .select('id')
        .eq('cohort_id', cohort.id)
        .eq('status', 'active')

      if (activeErr) {
        result.errors.push(`fetch active ${cohort.id}: ${activeErr.message}`)
        continue
      }

      const n = stillActive?.length ?? 0
      if (n > 0) {
        const { error: enrollErr } = await service
          .from('enrollments')
          .update({ status: 'completed', completed_at: nowIso })
          .eq('cohort_id', cohort.id)
          .eq('status', 'active')

        if (enrollErr) {
          result.errors.push(`complete enrollments ${cohort.id}: ${enrollErr.message}`)
        } else {
          result.completed_enrollments += n
        }
      }

      console.log(
        '[cohort-lifecycle] completed cohort', cohort.id, cohort.name, '→', n, 'enrollments',
      )
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    result.errors.push(`step2: ${msg}`)
    console.error('[cohort-lifecycle] step2:', msg)
  }

  return result
}
