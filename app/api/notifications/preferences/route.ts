import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const VALID_CHANNELS = ['email', 'zalo', 'both'] as const
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 })
  }

  const [prefsResult, profileResult] = await Promise.all([
    supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('profiles')
      .select('phone_verified')
      .eq('id', user.id)
      .single(),
  ])

  const { data: prefs, error } = prefsResult
  if (error) {
    console.error('[notifications/preferences] GET:', error)
    return NextResponse.json({ error: 'Lỗi truy vấn.' }, { status: 500 })
  }

  const phoneVerified = profileResult.data?.phone_verified === true

  // Return defaults if row hasn't been created yet (trigger may not have fired)
  const base = {
    user_id: user.id,
    morning_reminder: true,
    evening_confirmation: true,
    rescue_messages: true,
    community_updates: true,
    marketing_emails: false,
    preferred_channel: 'email' as const,
    morning_time: '07:00',
    evening_time: '21:00',
    timezone: 'Asia/Ho_Chi_Minh',
    phone_verified: phoneVerified,
  }

  if (!prefs) {
    return NextResponse.json(base)
  }

  return NextResponse.json({ ...prefs, phone_verified: phoneVerified })
}

// ─── PUT ──────────────────────────────────────────────────────────────────────

interface PrefBody {
  morning_reminder?: boolean
  evening_confirmation?: boolean
  rescue_messages?: boolean
  community_updates?: boolean
  marketing_emails?: boolean
  preferred_channel?: 'email' | 'zalo' | 'both'
  morning_time?: string
  evening_time?: string
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 })
  }

  let body: PrefBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  // ── Validate ────────────────────────────────────────────────────────────────
  const boolFields = ['morning_reminder', 'evening_confirmation', 'rescue_messages', 'community_updates', 'marketing_emails'] as const
  for (const field of boolFields) {
    if (body[field] !== undefined && typeof body[field] !== 'boolean') {
      return NextResponse.json({ error: `${field} phải là boolean.` }, { status: 400 })
    }
  }

  if (body.preferred_channel !== undefined && !(VALID_CHANNELS as readonly string[]).includes(body.preferred_channel)) {
    return NextResponse.json({ error: 'preferred_channel không hợp lệ.' }, { status: 400 })
  }

  if (body.morning_time !== undefined && !TIME_RE.test(body.morning_time)) {
    return NextResponse.json({ error: 'morning_time phải có dạng HH:MM.' }, { status: 400 })
  }

  if (body.evening_time !== undefined && !TIME_RE.test(body.evening_time)) {
    return NextResponse.json({ error: 'evening_time phải có dạng HH:MM.' }, { status: 400 })
  }

  // ── Build update payload (only include provided fields) ─────────────────────
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

  for (const field of boolFields) {
    if (body[field] !== undefined) updates[field] = body[field]
  }
  if (body.preferred_channel !== undefined) updates.preferred_channel = body.preferred_channel
  if (body.morning_time !== undefined) updates.morning_time = body.morning_time
  if (body.evening_time !== undefined) updates.evening_time = body.evening_time

  // ── Upsert ──────────────────────────────────────────────────────────────────
  const service = createServiceClient()
  const { data: updated, error: upsertError } = await service
    .from('notification_preferences')
    .upsert({ user_id: user.id, ...updates }, { onConflict: 'user_id' })
    .select()
    .single()

  if (upsertError) {
    console.error('[notifications/preferences] PUT upsert:', upsertError)
    return NextResponse.json({ error: 'Không thể lưu preferences.' }, { status: 500 })
  }

  return NextResponse.json(updated)
}
