import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
type SuggestedMode = 'hard' | 'light' | 'recovery'

function toRiskLevel(score: number): RiskLevel {
  if (score <= 20) return 'low'
  if (score <= 50) return 'medium'
  if (score <= 80) return 'high'
  return 'critical'
}

function toSuggestedMode(score: number): SuggestedMode {
  if (score < 30) return 'hard'
  if (score <= 60) return 'light'
  return 'recovery'
}

function daysMissed(lastCheckinDate: string | null): number {
  if (!lastCheckinDate) return 0
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z')
  const last = new Date(lastCheckinDate + 'T00:00:00Z')
  return Math.max(0, Math.round((today.getTime() - last.getTime()) / 86400000))
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 })
  }

  // ── Active enrollment ────────────────────────────────────────────────────────
  const { data: enrollment, error: enrollmentError } = await supabase
    .from('enrollments')
    .select('id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (enrollmentError) {
    console.error('[rescue/status] enrollment query:', enrollmentError)
    return NextResponse.json({ error: 'Lỗi truy vấn.' }, { status: 500 })
  }
  if (!enrollment) {
    return NextResponse.json({ error: 'Không có chương trình đang active.' }, { status: 404 })
  }

  const enrollmentId = enrollment.id

  // ── Parallel queries ─────────────────────────────────────────────────────────
  const [streakResult, riskResult, interventionsResult] = await Promise.all([
    supabase
      .from('streaks')
      .select('last_checkin_date')
      .eq('enrollment_id', enrollmentId)
      .maybeSingle(),

    supabase.rpc('calculate_risk_score', { p_enrollment_id: enrollmentId }),

    // 5 most recent rescue interventions, most recent first
    supabase
      .from('rescue_interventions')
      .select('id, trigger_reason, action_taken, created_at, message_sent, outcome, outcome_at')
      .eq('enrollment_id', enrollmentId)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  if (streakResult.error) console.error('[rescue/status] streak query:', streakResult.error)
  if (riskResult.error) console.error('[rescue/status] risk_score rpc:', riskResult.error)
  if (interventionsResult.error) console.error('[rescue/status] interventions query:', interventionsResult.error)

  const riskScore: number = typeof riskResult.data === 'number' ? riskResult.data : 0
  const lastCheckinDate = streakResult.data?.last_checkin_date ?? null
  const interventions = interventionsResult.data ?? []

  // Current intervention = most recent with outcome = 'pending'
  const currentIntervention = interventions.find(
    (i: { outcome: string }) => i.outcome === 'pending'
  ) ?? null

  return NextResponse.json({
    is_in_rescue: currentIntervention !== null,
    current_intervention: currentIntervention
      ? {
          id: currentIntervention.id,
          trigger_reason: currentIntervention.trigger_reason,
          action_taken: currentIntervention.action_taken,
          created_at: currentIntervention.created_at,
          message_sent: currentIntervention.message_sent,
        }
      : null,
    risk_score: riskScore,
    risk_level: toRiskLevel(riskScore),
    suggested_mode: toSuggestedMode(riskScore),
    days_missed: daysMissed(lastCheckinDate),
    rescue_history: interventions,
  })
}
