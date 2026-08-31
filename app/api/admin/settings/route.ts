import { NextRequest, NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/admin/verify-admin'
import {
  BUDDY_MATCHING_ENABLED,
  getBooleanSetting,
  setBooleanSetting,
} from '@/lib/settings'

/**
 * Setting toàn hệ thống — chỉ admin. Bảng app_settings (migration 073).
 * GET  → giá trị hiện tại
 * PUT  → { buddy_matching_enabled: boolean }
 */

export async function GET() {
  const auth = await verifyAdmin()
  if ('error' in auth) return auth.error

  return NextResponse.json({
    buddy_matching_enabled: await getBooleanSetting(BUDDY_MATCHING_ENABLED),
  })
}

export async function PUT(request: NextRequest) {
  const auth = await verifyAdmin()
  if ('error' in auth) return auth.error

  let body: { buddy_matching_enabled?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (typeof body.buddy_matching_enabled !== 'boolean') {
    return NextResponse.json(
      { error: 'buddy_matching_enabled phải là boolean.' },
      { status: 400 }
    )
  }

  try {
    const value = await setBooleanSetting(
      BUDDY_MATCHING_ENABLED,
      body.buddy_matching_enabled,
      auth.user.id
    )
    return NextResponse.json({ buddy_matching_enabled: value })
  } catch (err) {
    console.error('[admin/settings] PUT', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Lỗi khi lưu setting.' },
      { status: 500 }
    )
  }
}
