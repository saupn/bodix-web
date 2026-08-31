import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Setting toàn hệ thống — bảng `app_settings` (key/value jsonb, migration 073).
 * RLS chỉ cho admin đọc → mọi truy cập ở đây dùng service client.
 */

export const BUDDY_MATCHING_ENABLED = 'buddy_matching_enabled' as const

/** Giá trị mặc định khi thiếu row / lỗi query — luôn là phía AN TOÀN. */
const DEFAULTS: Record<string, boolean> = {
  [BUDDY_MATCHING_ENABLED]: false,
}

/**
 * Đọc setting boolean. Thiếu row, bảng chưa tạo, hoặc lỗi query → trả về mặc
 * định an toàn (buddy: false = KHÔNG ghép). Không bao giờ throw.
 */
export async function getBooleanSetting(
  key: string,
  client?: SupabaseClient
): Promise<boolean> {
  const fallback = DEFAULTS[key] ?? false
  const service = client ?? createServiceClient()

  const { data, error } = await service
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle()

  if (error) {
    console.error('[settings] read', key, error.message)
    return fallback
  }
  if (!data) return fallback

  return data.value === true
}

/** Ghi setting boolean. Trả về giá trị đã lưu. */
export async function setBooleanSetting(
  key: string,
  value: boolean,
  updatedBy?: string | null,
  client?: SupabaseClient
): Promise<boolean> {
  const service = client ?? createServiceClient()

  const { error } = await service.from('app_settings').upsert(
    {
      key,
      value,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy ?? null,
    },
    { onConflict: 'key' }
  )

  if (error) {
    console.error('[settings] write', key, error.message)
    throw new Error(`Không lưu được setting ${key}: ${error.message}`)
  }

  return value
}

/** Cờ ghép cặp buddy toàn hệ thống. Mặc định TẮT. */
export function isBuddyMatchingEnabled(client?: SupabaseClient): Promise<boolean> {
  return getBooleanSetting(BUDDY_MATCHING_ENABLED, client)
}
