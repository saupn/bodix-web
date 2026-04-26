/**
 * Edge Function: weekly-report
 *
 * Gửi báo cáo tuần cho founder vào Thứ 2 8:00 AM ICT (01:00 UTC).
 *
 * Deploy:
 *   npx supabase functions deploy weekly-report
 *
 * Cron setup:
 *   select cron.schedule(
 *     'weekly-report',
 *     '0 1 * * 1',
 *     $$ select net.http_post(
 *       url     := 'https://<project-ref>.supabase.co/functions/v1/weekly-report',
 *       headers := '{"x-function-secret": "<WEEKLY_REPORT_SECRET>"}'::jsonb
 *     ) $$
 *   );
 *
 * Env vars: WEEKLY_REPORT_SECRET, FOUNDER_EMAIL
 */

import { createAdminClient } from '../_shared/supabase-admin.ts'

const FUNCTION_SECRET = Deno.env.get('WEEKLY_REPORT_SECRET') ?? ''
const FOUNDER_EMAIL   = Deno.env.get('FOUNDER_EMAIL') ?? ''
const RESEND_API_KEY  = Deno.env.get('RESEND_API_KEY') ?? ''
const FROM_EMAIL      = Deno.env.get('FROM_EMAIL') ?? 'noreply@bodix.fit'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WeekMetrics {
  week_label: string           // "Tuần 10 (3/3 – 9/3)"
  week_start: string           // ISO date
  week_end: string

  revenue: number
  signups: number
  purchases: number
  active_users: number

  avg_d7_adherence: number | null
  avg_completion_rate: number | null
  avg_nps: number | null
  referral_share: number | null
  churn_rate: number | null
}

interface Delta {
  value: number | null
  prev: number | null
  delta: number | null          // absolute change
  delta_pct: number | null      // % change
  direction: 'up' | 'down' | 'neutral'
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Returns Monday–Sunday range for N weeks ago (0 = current/just-ended week). */
function weekRange(weeksAgo: number): { start: string; end: string; label: string } {
  const now = new Date()
  // Shift to Monday of this week
  const dayOfWeek = now.getUTCDay() === 0 ? 7 : now.getUTCDay() // Mon=1 … Sun=7
  const thisMonday = new Date(now)
  thisMonday.setUTCDate(now.getUTCDate() - (dayOfWeek - 1))
  thisMonday.setUTCHours(0, 0, 0, 0)

  const start = new Date(thisMonday)
  start.setUTCDate(thisMonday.getUTCDate() - weeksAgo * 7)
  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 6)

  const fmtDay = (d: Date) => `${d.getUTCDate()}/${d.getUTCMonth() + 1}`
  const label = `${fmtDay(start)} – ${fmtDay(end)}`

  return { start: isoDate(start), end: isoDate(end), label }
}

// ─── Metrics query ────────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function fetchWeekMetrics(supabase: any, range: { start: string; end: string; label: string }): Promise<WeekMetrics> {
  const startTs = `${range.start}T00:00:00Z`
  const endTs   = `${range.end}T23:59:59Z`

  const [
    revenueRes,
    signupsRes,
    purchasesRes,
    activeRes,
    programRes,
    referralRes,
    churnRes,
  ] = await Promise.all([
    supabase.from('enrollments')
      .select('amount_paid')
      .gte('paid_at', startTs).lte('paid_at', endTs)
      .neq('status', 'trial'),

    supabase.from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startTs).lte('created_at', endTs),

    supabase.from('enrollments')
      .select('*', { count: 'exact', head: true })
      .gte('paid_at', startTs).lte('paid_at', endTs)
      .neq('status', 'trial'),

    supabase.from('enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active'),

    supabase.from('mv_program_analytics')
      .select('overall_completion_rate, avg_nps_score, d7_adherence'),

    supabase.from('mv_monthly_revenue')
      .select('referral_share_percent')
      .order('month', { ascending: false })
      .limit(1)
      .maybeSingle(),

    supabase.from('enrollments')
      .select('status')
      .in('status', ['active', 'dropped'])
      .gte('created_at', startTs).lte('created_at', endTs),
  ])

  const revenue     = (revenueRes.data ?? []).reduce((s: number, e: { amount_paid: number }) => s + (e.amount_paid ?? 0), 0)
  const signups     = signupsRes.count ?? 0
  const purchases   = purchasesRes.count ?? 0
  const activeUsers = activeRes.count ?? 0

  const progRows = (programRes.data ?? []) as Array<Record<string, number>>
  const avgOf = (key: string) => progRows.length
    ? Math.round(progRows.reduce((s, p) => s + (p[key] ?? 0), 0) / progRows.length * 10) / 10
    : null

  const refShare = (referralRes.data?.referral_share_percent as number) ?? null

  const churnRows = (churnRes.data ?? []) as Array<{ status: string }>
  const droppedCount = churnRows.filter(e => e.status === 'dropped').length
  const churnRate = churnRows.length
    ? Math.round(droppedCount / churnRows.length * 1000) / 10
    : null

  return {
    week_label:          range.label,
    week_start:          range.start,
    week_end:            range.end,
    revenue,
    signups,
    purchases,
    active_users:        activeUsers,
    avg_d7_adherence:    avgOf('d7_adherence'),
    avg_completion_rate: avgOf('overall_completion_rate'),
    avg_nps:             avgOf('avg_nps_score'),
    referral_share:      refShare,
    churn_rate:          churnRate,
  }
}

// ─── Delta computation ────────────────────────────────────────────────────────

function delta(current: number | null, previous: number | null): Delta {
  if (current == null || previous == null) {
    return { value: current, prev: previous, delta: null, delta_pct: null, direction: 'neutral' }
  }
  const abs = Math.round((current - previous) * 10) / 10
  const pct = previous !== 0 ? Math.round(abs / previous * 1000) / 10 : null
  return {
    value: current,
    prev: previous,
    delta: abs,
    delta_pct: pct,
    direction: abs > 0 ? 'up' : abs < 0 ? 'down' : 'neutral',
  }
}

// ─── Action items ─────────────────────────────────────────────────────────────

function generateActionItems(current: WeekMetrics, previous: WeekMetrics): string[] {
  const actions: string[] = []

  if ((current.avg_d7_adherence ?? 100) < 70) {
    actions.push('📌 D7 adherence dưới 70% — Review nội dung ngày 3–7, kiểm tra độ khó và tính liên tục')
  }

  const completionDelta = (current.avg_completion_rate ?? 0) - (previous.avg_completion_rate ?? 0)
  if (completionDelta < -5) {
    actions.push(`📌 Completion rate giảm ${Math.abs(completionDelta).toFixed(1)}% — Kiểm tra rescue protocol, review dropout_signals tuần này`)
  }

  if ((current.avg_nps ?? 100) < 50) {
    actions.push('📌 NPS dưới 50 — Đọc feedback mid-program, identify pain points cụ thể')
  }

  if ((current.referral_share ?? 100) < 10) {
    actions.push('📌 Referral share dưới 10% — Tăng visibility referral prompts (sau milestone streak_7, program_complete)')
  }

  if ((current.churn_rate ?? 0) > 20) {
    actions.push(`📌 Churn rate ${current.churn_rate}% — Cao bất thường, kiểm tra cohort nào đang bị dropout nhiều nhất`)
  }

  const revDelta = current.revenue - previous.revenue
  if (previous.revenue > 0 && revDelta / previous.revenue < -0.2) {
    actions.push(`📌 Doanh thu giảm ${Math.abs(Math.round(revDelta / previous.revenue * 100))}% — Kiểm tra acquisition channel và trial conversion`)
  }

  if (!actions.length) {
    actions.push('✅ Không có vấn đề nổi bật — Tiếp tục theo dõi cohort đang active')
  }

  return actions
}

// ─── HTML email builder ───────────────────────────────────────────────────────

function arrowHtml(d: Delta, lowerIsBetter = false): string {
  if (d.direction === 'neutral' || d.delta == null) return '<span style="color:#999">—</span>'
  const isGood = lowerIsBetter ? d.direction === 'down' : d.direction === 'up'
  const color = isGood ? '#22c55e' : '#ef4444'
  const arrow = d.direction === 'up' ? '▲' : '▼'
  const pctStr = d.delta_pct != null ? ` (${d.delta_pct > 0 ? '+' : ''}${d.delta_pct}%)` : ''
  return `<span style="color:${color}">${arrow} ${d.delta > 0 ? '+' : ''}${d.delta}${pctStr}</span>`
}

function fmtVnd(v: number): string {
  return (v / 1_000_000).toFixed(1) + 'M'
}

function buildHtmlEmail(
  current: WeekMetrics,
  previous: WeekMetrics,
  topCohort: { cohort_name: string; completion_rate: number; total_enrollments: number } | null,
  actionItems: string[],
  weekNumber: number
): string {
  const rows: Array<{ label: string; value: string; d: Delta; lowerIsBetter?: boolean }> = [
    { label: '💰 Doanh thu',         value: fmtVnd(current.revenue),         d: delta(current.revenue, previous.revenue) },
    { label: '👤 Đăng ký mới',       value: String(current.signups),          d: delta(current.signups, previous.signups) },
    { label: '🛒 Mua chương trình',  value: String(current.purchases),        d: delta(current.purchases, previous.purchases) },
    { label: '🏃 Đang active',       value: String(current.active_users),     d: delta(current.active_users, previous.active_users) },
    { label: '📅 D7 Adherence',      value: pct(current.avg_d7_adherence),    d: delta(current.avg_d7_adherence, previous.avg_d7_adherence) },
    { label: '🏆 Completion Rate',   value: pct(current.avg_completion_rate), d: delta(current.avg_completion_rate, previous.avg_completion_rate) },
    { label: '⭐ NPS',               value: pct(current.avg_nps),             d: delta(current.avg_nps, previous.avg_nps) },
    { label: '🔗 Referral Share',    value: pct(current.referral_share),      d: delta(current.referral_share, previous.referral_share) },
    { label: '📉 Churn Rate',        value: pct(current.churn_rate),          d: delta(current.churn_rate, previous.churn_rate), lowerIsBetter: true },
  ]

  const tableRows = rows.map(r => `
    <tr style="border-bottom:1px solid #f0f0f0">
      <td style="padding:10px 12px;font-size:14px;color:#374151">${r.label}</td>
      <td style="padding:10px 12px;font-size:14px;font-weight:600;color:#111827;text-align:right">${r.value}</td>
      <td style="padding:10px 12px;font-size:13px;text-align:right">${arrowHtml(r.d, r.lowerIsBetter)}</td>
    </tr>`).join('')

  const actionHtml = actionItems.map(a =>
    `<li style="margin:6px 0;font-size:14px;color:#374151">${a}</li>`
  ).join('')

  const topCohortHtml = topCohort ? `
    <div style="background:#f0fdf4;border-radius:8px;padding:16px;margin:20px 0">
      <p style="margin:0;font-size:13px;color:#166534;font-weight:600">🥇 Top Cohort tuần này</p>
      <p style="margin:4px 0 0;font-size:15px;color:#14532d;font-weight:700">${topCohort.cohort_name}</p>
      <p style="margin:2px 0 0;font-size:13px;color:#15803d">
        ${topCohort.completion_rate}% completion · ${topCohort.total_enrollments} members
      </p>
    </div>` : ''

  return `<!DOCTYPE html>
<html lang="vi">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1)">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#111827 0%,#1f2937 100%);padding:28px 32px">
      <p style="margin:0;font-size:11px;letter-spacing:2px;color:#9ca3af;text-transform:uppercase">BodiX Internal</p>
      <h1 style="margin:8px 0 4px;font-size:24px;color:#fff;font-weight:700">📊 Báo cáo Tuần ${weekNumber}</h1>
      <p style="margin:0;font-size:13px;color:#9ca3af">${current.week_label} · so với ${previous.week_label}</p>
    </div>

    <!-- KPI Table -->
    <div style="padding:24px 32px 8px">
      <h2 style="margin:0 0 16px;font-size:16px;color:#111827;font-weight:600">KPI Tuần này</h2>
      <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
        <thead>
          <tr style="background:#f9fafb">
            <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.5px">Chỉ số</th>
            <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.5px">Tuần này</th>
            <th style="padding:10px 12px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.5px">vs Tuần trước</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>

    ${topCohortHtml}

    <!-- Action Items -->
    <div style="padding:16px 32px 24px">
      <h2 style="margin:0 0 12px;font-size:16px;color:#111827;font-weight:600">🎯 Cần chú ý</h2>
      <ul style="margin:0;padding-left:20px">${actionHtml}</ul>
    </div>

    <!-- Footer -->
    <div style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb">
      <p style="margin:0;font-size:12px;color:#9ca3af">
        Generated automatically · ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} ICT
        · <a href="https://bodix.fit/admin/analytics" style="color:#6b7280">Xem full analytics</a>
      </p>
    </div>

  </div>
</body>
</html>`
}

function pct(v: number | null): string {
  return v != null ? `${v}%` : '—'
}

// ─── Send via Resend ──────────────────────────────────────────────────────────

async function sendHtmlEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.log('[weekly-report] No RESEND_API_KEY — logging email instead')
    console.log(`To: ${to}\nSubject: ${subject}\n[HTML body omitted]`)
    return true
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[weekly-report] Resend error:', res.status, err)
      return false
    }
    return true
  } catch (err) {
    console.error('[weekly-report] sendHtmlEmail:', err)
    return false
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (FUNCTION_SECRET) {
    const provided = req.headers.get('x-function-secret')
    if (provided !== FUNCTION_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  const supabase = createAdminClient()

  try {
    // ── 1. Refresh materialized views ───────────────────────────────────────
    console.log('[weekly-report] Refreshing materialized views…')
    const { error: refreshError } = await supabase.rpc('refresh_analytics_views')
    if (refreshError) {
      console.error('[weekly-report] refresh views:', refreshError)
      // Non-fatal — proceed with potentially stale views
    }

    // ── 2. Fetch this week + last week metrics ──────────────────────────────
    const thisWeekRange = weekRange(1)  // just-ended week (Mon–Sun)
    const lastWeekRange = weekRange(2)  // the week before

    console.log(`[weekly-report] Fetching metrics for ${thisWeekRange.start} – ${thisWeekRange.end}`)

    const [currentMetrics, previousMetrics] = await Promise.all([
      fetchWeekMetrics(supabase, thisWeekRange),
      fetchWeekMetrics(supabase, lastWeekRange),
    ])

    // Derive week number from current year
    const weekStart = new Date(thisWeekRange.start)
    const startOfYear = new Date(weekStart.getUTCFullYear(), 0, 1)
    const weekNumber = Math.ceil(((weekStart.getTime() - startOfYear.getTime()) / 86_400_000 + startOfYear.getDay() + 1) / 7)

    // ── 3. Top cohort (highest completion_rate with >= 3 enrollments) ───────
    const { data: cohortRows } = await supabase
      .from('mv_cohort_analytics')
      .select('cohort_name, completion_rate, total_enrollments')
      .in('cohort_status', ['active', 'completed'])
      .gte('total_enrollments', 3)
      .order('completion_rate', { ascending: false })
      .limit(1)
      .maybeSingle()

    const topCohort = cohortRows
      ? { cohort_name: cohortRows.cohort_name as string, completion_rate: cohortRows.completion_rate as number, total_enrollments: cohortRows.total_enrollments as number }
      : null

    // ── 4. Generate action items ────────────────────────────────────────────
    const actionItems = generateActionItems(currentMetrics, previousMetrics)

    // ── 5. Build HTML ───────────────────────────────────────────────────────
    const subject  = `📊 BodiX Tuần ${weekNumber} (${thisWeekRange.label})`
    const htmlBody = buildHtmlEmail(currentMetrics, previousMetrics, topCohort, actionItems, weekNumber)

    // ── 6. Send email ───────────────────────────────────────────────────────
    let sent = false
    if (FOUNDER_EMAIL) {
      sent = await sendHtmlEmail(FOUNDER_EMAIL, subject, htmlBody)
      console.log(`[weekly-report] email to ${FOUNDER_EMAIL}: ${sent ? 'sent' : 'failed'}`)
    } else {
      console.warn('[weekly-report] FOUNDER_EMAIL not set — skipping send')
    }

    // ── 7. Persist to admin_reports ─────────────────────────────────────────
    const reportData = {
      week_number:     weekNumber,
      week_start:      thisWeekRange.start,
      week_end:        thisWeekRange.end,
      current_metrics: currentMetrics,
      previous_metrics: previousMetrics,
      top_cohort:      topCohort,
      action_items:    actionItems,
      subject,
    }

    const { error: insertError } = await supabase.from('admin_reports').insert({
      report_type: 'weekly_founder',
      report_date: thisWeekRange.start,
      data:        reportData,
      sent_at:     sent ? new Date().toISOString() : null,
    })

    if (insertError) console.error('[weekly-report] insert admin_reports:', insertError)

    const response = {
      success: true,
      week:    weekNumber,
      period:  `${thisWeekRange.start} – ${thisWeekRange.end}`,
      email_sent: sent,
      action_items: actionItems,
      metrics: {
        revenue:      currentMetrics.revenue,
        signups:      currentMetrics.signups,
        purchases:    currentMetrics.purchases,
        d7_adherence: currentMetrics.avg_d7_adherence,
        nps:          currentMetrics.avg_nps,
      },
    }

    console.log('[weekly-report] completed:', JSON.stringify(response))
    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('[weekly-report] fatal:', err)
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
