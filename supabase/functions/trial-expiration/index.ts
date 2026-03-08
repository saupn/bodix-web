/**
 * Edge Function: trial-expiration
 *
 * Chạy theo cron mỗi giờ để:
 *   1. Cập nhật trial hết hạn → 'pending_payment', gửi thông báo
 *   2. Gửi reminder khi trial còn 24h
 *   3. Gửi reminder khi trial còn 6h
 *
 * Deploy: npx supabase functions deploy trial-expiration
 *
 * Cron setup (chọn 1):
 *   Option A — Supabase Dashboard > Edge Functions > Schedule:
 *     Cron: "0 * * * *"  (mỗi giờ)
 *
 *   Option B — pg_cron (require Pro plan):
 *     select cron.schedule(
 *       'trial-expiration-hourly',
 *       '0 * * * *',
 *       $$ select net.http_post(
 *         url := 'https://<project>.supabase.co/functions/v1/trial-expiration',
 *         headers := '{"x-function-secret": "<TRIAL_EXPIRATION_SECRET>"}'::jsonb
 *       ) $$
 *     );
 *
 * Env vars cần set (Dashboard > Edge Functions > Secrets):
 *   TRIAL_EXPIRATION_SECRET  — key để protect endpoint khỏi invocation trái phép
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const FUNCTION_SECRET = Deno.env.get('TRIAL_EXPIRATION_SECRET') ?? ''

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SupabaseClient = ReturnType<typeof createClient>

type ReminderType = 'trial_reminder_24h' | 'trial_reminder_6h'

interface ProcessResult {
  processed: number
  skipped: number
  errors: number
}

// ---------------------------------------------------------------------------
// Notification senders (placeholders)
// ---------------------------------------------------------------------------

/**
 * TODO: Tích hợp provider email thật.
 * Gợi ý: Resend (https://resend.com) hoặc SendGrid.
 * Lấy email từ: const { data } = await supabase.auth.admin.getUserById(userId)
 */
async function sendEmail(userId: string, subject: string, body: string): Promise<void> {
  console.log(`[email mock] userId=${userId} | subject=${subject} | body=${body}`)
}

/**
 * TODO: Tích hợp Zalo ZNS API.
 * Docs: https://developers.zalo.me/docs/zalo-notification-service
 * Cần: ZNS App ID, Access Token, và Template ID đã được duyệt.
 */
async function sendZaloZNS(
  phone: string,
  templateId: string,
  params: Record<string, string>
): Promise<void> {
  console.log(`[zalo mock] phone=${phone} | template=${templateId}`, params)
}

// ---------------------------------------------------------------------------
// Job 1: Expired trials → pending_payment
// ---------------------------------------------------------------------------

async function processExpiredTrials(supabase: SupabaseClient): Promise<ProcessResult> {
  const result: ProcessResult = { processed: 0, skipped: 0, errors: 0 }
  const now = new Date().toISOString()

  // 1. Profiles có trial đã hết hạn
  const { data: expiredProfiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, phone, full_name, trial_ends_at')
    .lt('trial_ends_at', now)
    .not('trial_ends_at', 'is', null)

  if (profilesError) {
    console.error('[expired] profiles query failed:', profilesError)
    return result
  }
  if (!expiredProfiles?.length) return result

  const userIds = expiredProfiles.map((p) => p.id)

  // 2. Lấy enrollments đang ở status='trial' cho các users này
  const { data: trialEnrollments } = await supabase
    .from('enrollments')
    .select('id, user_id, program_id, program:programs(name)')
    .in('user_id', userIds)
    .eq('status', 'trial')

  if (!trialEnrollments?.length) return result

  // 3. Dedup: bỏ qua user đã nhận thông báo 'trial_expired'
  const { data: existingNotifs } = await supabase
    .from('notifications')
    .select('user_id')
    .in('user_id', userIds)
    .eq('type', 'trial_expired')

  const alreadyNotified = new Set(existingNotifs?.map((n) => n.user_id) ?? [])
  const toProcess = trialEnrollments.filter((e) => !alreadyNotified.has(e.user_id))

  if (!toProcess.length) {
    result.skipped = trialEnrollments.length
    return result
  }

  const profileMap = new Map(expiredProfiles.map((p) => [p.id, p]))

  // 4. Batch update enrollments → 'pending_payment'
  const { error: updateError } = await supabase
    .from('enrollments')
    .update({ status: 'pending_payment' })
    .in('id', toProcess.map((e) => e.id))

  if (updateError) {
    console.error('[expired] enrollment update failed:', updateError)
    result.errors += toProcess.length
    return result
  }

  // 5. Insert notifications
  const notifications = toProcess.flatMap((enrollment) => {
    const profile = profileMap.get(enrollment.user_id)
    if (!profile) return []

    const programName = (enrollment.program as { name: string } | null)?.name ?? 'BodiX'
    const base = {
      user_id: enrollment.user_id,
      type: 'trial_expired',
      title: 'Thời gian dùng thử đã kết thúc',
      content: `Thời gian dùng thử ${programName} đã kết thúc. Đăng ký ngay để bắt đầu hành trình!`,
      metadata: { program_id: enrollment.program_id, enrollment_id: enrollment.id },
      sent_at: now,
    }

    const rows = [{ ...base, channel: 'email' }]
    if (profile.phone) rows.push({ ...base, channel: 'zalo' })
    return rows
  })

  if (notifications.length) {
    const { error: notifError } = await supabase.from('notifications').insert(notifications)
    if (notifError) console.error('[expired] notifications insert failed:', notifError)
  }

  // 6. Fire placeholder senders
  await Promise.allSettled(
    toProcess.map(async (enrollment) => {
      const profile = profileMap.get(enrollment.user_id)
      if (!profile) return

      const programName = (enrollment.program as { name: string } | null)?.name ?? 'BodiX'
      const subject = `Thời gian dùng thử ${programName} đã kết thúc`
      const body = `Đăng ký ngay để bắt đầu hành trình của bạn!`

      try {
        await sendEmail(enrollment.user_id, subject, body)
        if (profile.phone) {
          await sendZaloZNS(profile.phone, 'trial_expired', { program_name: programName })
        }
        result.processed++
      } catch (err) {
        console.error(`[expired] send failed for user ${enrollment.user_id}:`, err)
        result.errors++
      }
    })
  )

  result.skipped = trialEnrollments.length - toProcess.length
  return result
}

// ---------------------------------------------------------------------------
// Job 2 & 3: Reminder notifications (24h and 6h before expiry)
// ---------------------------------------------------------------------------

const REMINDER_CONFIG: Record<
  ReminderType,
  { windowMs: number; dedupWindowMs: number; title: string; content: string }
> = {
  trial_reminder_24h: {
    windowMs: 24 * 60 * 60 * 1000,
    dedupWindowMs: 25 * 60 * 60 * 1000,
    title: 'Còn 1 ngày trải nghiệm!',
    content: 'Còn 1 ngày trải nghiệm! Bạn đã thử bài tập chưa?',
  },
  trial_reminder_6h: {
    windowMs: 6 * 60 * 60 * 1000,
    dedupWindowMs: 7 * 60 * 60 * 1000,
    title: 'Sắp hết thời gian trải nghiệm rồi!',
    content: 'Sắp hết thời gian trải nghiệm rồi! Đừng bỏ lỡ cơ hội.',
  },
}

async function processReminders(
  supabase: SupabaseClient,
  type: ReminderType
): Promise<ProcessResult> {
  const result: ProcessResult = { processed: 0, skipped: 0, errors: 0 }
  const config = REMINDER_CONFIG[type]
  const now = Date.now()
  const nowIso = new Date(now).toISOString()
  const windowEndIso = new Date(now + config.windowMs).toISOString()
  const dedupCutoffIso = new Date(now - config.dedupWindowMs).toISOString()

  // 1. Profiles với trial kết thúc trong cửa sổ thời gian
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, phone, full_name, trial_ends_at')
    .gt('trial_ends_at', nowIso)
    .lt('trial_ends_at', windowEndIso)

  if (profilesError) {
    console.error(`[${type}] profiles query failed:`, profilesError)
    return result
  }
  if (!profiles?.length) return result

  const userIds = profiles.map((p) => p.id)

  // 2. Dedup: bỏ qua user đã nhận reminder này trong cửa sổ dedup
  const { data: existingNotifs } = await supabase
    .from('notifications')
    .select('user_id')
    .in('user_id', userIds)
    .eq('type', type)
    .gt('created_at', dedupCutoffIso)

  const alreadyNotified = new Set(existingNotifs?.map((n) => n.user_id) ?? [])
  const toProcess = profiles.filter((p) => !alreadyNotified.has(p.id))

  if (!toProcess.length) {
    result.skipped = profiles.length
    return result
  }

  // 3. Lấy enrollment context (để biết tên chương trình)
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('user_id, program_id, program:programs(name)')
    .in('user_id', toProcess.map((p) => p.id))
    .eq('status', 'trial')

  const enrollmentMap = new Map(enrollments?.map((e) => [e.user_id, e]) ?? [])

  // 4. Insert notifications
  const notifications = toProcess.flatMap((profile) => {
    const enrollment = enrollmentMap.get(profile.id)
    const base = {
      user_id: profile.id,
      type,
      title: config.title,
      content: config.content,
      metadata: enrollment
        ? {
            program_id: enrollment.program_id,
            program_name: (enrollment.program as { name: string } | null)?.name,
          }
        : {},
      sent_at: nowIso,
    }

    const rows = [{ ...base, channel: 'email' }]
    if (profile.phone) rows.push({ ...base, channel: 'zalo' })
    return rows
  })

  const { error: notifError } = await supabase.from('notifications').insert(notifications)
  if (notifError) {
    console.error(`[${type}] notifications insert failed:`, notifError)
    result.errors += toProcess.length
    return result
  }

  // 5. Fire placeholder senders
  await Promise.allSettled(
    toProcess.map(async (profile) => {
      const enrollment = enrollmentMap.get(profile.id)
      const programName =
        (enrollment?.program as { name: string } | null)?.name ?? 'BodiX'

      try {
        await sendEmail(profile.id, config.title, config.content)
        if (profile.phone) {
          await sendZaloZNS(profile.phone, type, { program_name: programName })
        }
        result.processed++
      } catch (err) {
        console.error(`[${type}] send failed for user ${profile.id}:`, err)
        result.errors++
      }
    })
  )

  result.skipped = profiles.length - toProcess.length
  return result
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  // Bảo vệ endpoint bằng secret header (set TRIAL_EXPIRATION_SECRET trong Function Secrets)
  if (FUNCTION_SECRET) {
    const providedSecret = req.headers.get('x-function-secret')
    if (providedSecret !== FUNCTION_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Chạy 3 jobs song song
    const [expiredResult, reminder24hResult, reminder6hResult] = await Promise.all([
      processExpiredTrials(supabase),
      processReminders(supabase, 'trial_reminder_24h'),
      processReminders(supabase, 'trial_reminder_6h'),
    ])

    const response = {
      success: true,
      processed_at: new Date().toISOString(),
      results: {
        expired: expiredResult,
        reminder_24h: reminder24hResult,
        reminder_6h: reminder6hResult,
      },
    }

    console.log('[trial-expiration] completed:', JSON.stringify(response))

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[trial-expiration] fatal error:', err)
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
