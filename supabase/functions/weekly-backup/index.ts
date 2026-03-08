/**
 * Edge Function: weekly-backup
 *
 * Chạy Chủ nhật 3:00 ICT (20:00 UTC thứ Bảy).
 * Export 4 bảng chính → JSON → upload lên Supabase Storage bucket "backups".
 * Giữ tối đa 4 bản backup gần nhất, xóa các bản cũ hơn.
 *
 * Deploy:
 *   npx supabase functions deploy weekly-backup
 *
 * Cron setup — chọn 1 trong 2:
 *   Option A — Supabase Dashboard > Edge Functions > Schedule:
 *     Cron: "0 20 * * 6"   (Chủ nhật 3:00 ICT)
 *
 *   Option B — pg_cron (yêu cầu Pro plan):
 *     select cron.schedule(
 *       'weekly-backup',
 *       '0 20 * * 6',
 *       $$ select net.http_post(
 *         url     := 'https://<project-ref>.supabase.co/functions/v1/weekly-backup',
 *         headers := '{"x-function-secret": "<WEEKLY_BACKUP_SECRET>"}'::jsonb
 *       ) $$
 *     );
 *
 * Storage bucket setup (Supabase Dashboard > Storage):
 *   1. Tạo bucket "backups" — private (không public)
 *   2. Không cần RLS policy — chỉ service_role truy cập
 *
 * Env vars (Dashboard > Edge Functions > Secrets):
 *   WEEKLY_BACKUP_SECRET — bảo vệ endpoint khỏi invocation trái phép
 */

import { createAdminClient } from '../_shared/supabase-admin.ts'

// ─── Config ───────────────────────────────────────────────────────────────────

const FUNCTION_SECRET = Deno.env.get('WEEKLY_BACKUP_SECRET') ?? ''
const BUCKET = 'backups'
const FOLDER = 'weekly'
const MAX_BACKUPS = 4       // số bản backup giữ lại
const BATCH_SIZE = 1000     // rows mỗi lần fetch (tránh timeout với bảng lớn)

// ─── Types ────────────────────────────────────────────────────────────────────

interface TableExport {
  table: string
  rows: number
  data: unknown[]
}

interface BackupManifest {
  version: 1
  created_at: string
  date: string
  tables: {
    profiles: number
    enrollments: number
    daily_checkins: number
    streaks: number
  }
  total_rows: number
}

interface BackupPayload {
  manifest: BackupManifest
  profiles: unknown[]
  enrollments: unknown[]
  daily_checkins: unknown[]
  streaks: unknown[]
}

// ─── Fetch full table with pagination ────────────────────────────────────────

async function fetchAll(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  table: string,
  columns: string
): Promise<TableExport> {
  const rows: unknown[] = []
  let offset = 0

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(offset, offset + BATCH_SIZE - 1)
      .order('created_at', { ascending: true })

    if (error) {
      console.error(`[weekly-backup] fetchAll ${table} error at offset ${offset}:`, error)
      throw new Error(`Failed to fetch ${table}: ${error.message}`)
    }

    if (!data?.length) break
    rows.push(...data)

    if (data.length < BATCH_SIZE) break
    offset += BATCH_SIZE
  }

  console.log(`[weekly-backup] fetched ${rows.length} rows from ${table}`)
  return { table, rows: rows.length, data: rows }
}

// ─── Upload JSON to Storage ───────────────────────────────────────────────────

async function uploadBackup(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  filename: string,
  payload: BackupPayload
): Promise<void> {
  const json = JSON.stringify(payload)
  const bytes = new TextEncoder().encode(json)

  const storagePath = `${FOLDER}/${filename}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, bytes, {
      contentType: 'application/json',
      upsert: true,
    })

  if (error) {
    console.error('[weekly-backup] upload error:', error)
    throw new Error(`Upload failed: ${error.message}`)
  }

  console.log(`[weekly-backup] uploaded ${storagePath} (${(bytes.length / 1024).toFixed(1)} KB)`)
}

// ─── Prune old backups — keep MAX_BACKUPS most recent ────────────────────────

async function pruneOldBackups(
  // deno-lint-ignore no-explicit-any
  supabase: any
): Promise<number> {
  // List all files in the folder, sorted by name (ISO dates sort lexicographically)
  const { data: files, error } = await supabase.storage
    .from(BUCKET)
    .list(FOLDER, {
      limit: 100,
      sortBy: { column: 'name', order: 'asc' },
    })

  if (error) {
    console.error('[weekly-backup] list error:', error)
    return 0
  }

  if (!files?.length) return 0

  // Filter to JSON backup files only (safety: ignore unrelated files)
  const backupFiles = (files as Array<{ name: string }>)
    .filter(f => f.name.startsWith('backup_') && f.name.endsWith('.json'))
    .sort((a, b) => a.name.localeCompare(b.name))  // oldest first

  const toDelete = backupFiles.slice(0, Math.max(0, backupFiles.length - MAX_BACKUPS))

  if (!toDelete.length) {
    console.log(`[weekly-backup] no pruning needed (${backupFiles.length} backups)`)
    return 0
  }

  const paths = toDelete.map(f => `${FOLDER}/${f.name}`)
  const { error: deleteError } = await supabase.storage
    .from(BUCKET)
    .remove(paths)

  if (deleteError) {
    console.error('[weekly-backup] prune error:', deleteError)
    return 0
  }

  console.log(`[weekly-backup] pruned ${paths.length} old backup(s): ${paths.join(', ')}`)
  return paths.length
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  // Protect endpoint
  if (FUNCTION_SECRET) {
    const provided = req.headers.get('x-function-secret')
    if (provided !== FUNCTION_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  const startedAt = new Date()
  const dateStr = startedAt.toISOString().slice(0, 10)   // YYYY-MM-DD
  const filename = `backup_${dateStr}.json`

  console.log(`[weekly-backup] starting backup for ${dateStr}`)

  const supabase = createAdminClient()

  try {
    // ── 1. Export all 4 tables in parallel ────────────────────────────────────
    // profiles: exclude sensitive fields — keep only what's needed for recovery
    const [profilesExport, enrollmentsExport, checkinsExport, streaksExport] =
      await Promise.all([
        fetchAll(
          supabase,
          'profiles',
          'id, full_name, phone, phone_verified, date_of_birth, gender, fitness_goal, trial_started_at, trial_ends_at, role, created_at, updated_at'
        ),
        fetchAll(
          supabase,
          'enrollments',
          'id, user_id, program_id, cohort_id, status, enrolled_at, paid_at, started_at, completed_at, current_day, payment_method, amount_paid, referral_code_id, created_at, updated_at'
        ),
        fetchAll(
          supabase,
          'daily_checkins',
          'id, enrollment_id, user_id, cohort_id, day_number, workout_date, mode, feeling, duration_minutes, completed_at'
        ),
        fetchAll(
          supabase,
          'streaks',
          'id, enrollment_id, user_id, current_streak, longest_streak, total_completed_days, total_hard_days, total_light_days, total_recovery_days, total_skip_days, last_checkin_date, streak_started_at, updated_at'
        ),
      ])

    const totalRows =
      profilesExport.rows +
      enrollmentsExport.rows +
      checkinsExport.rows +
      streaksExport.rows

    // ── 2. Build payload ──────────────────────────────────────────────────────
    const manifest: BackupManifest = {
      version: 1,
      created_at: startedAt.toISOString(),
      date: dateStr,
      tables: {
        profiles: profilesExport.rows,
        enrollments: enrollmentsExport.rows,
        daily_checkins: checkinsExport.rows,
        streaks: streaksExport.rows,
      },
      total_rows: totalRows,
    }

    const payload: BackupPayload = {
      manifest,
      profiles: profilesExport.data,
      enrollments: enrollmentsExport.data,
      daily_checkins: checkinsExport.data,
      streaks: streaksExport.data,
    }

    // ── 3. Upload to Storage ──────────────────────────────────────────────────
    await uploadBackup(supabase, filename, payload)

    // ── 4. Prune old backups ──────────────────────────────────────────────────
    const pruned = await pruneOldBackups(supabase)

    const durationMs = Date.now() - startedAt.getTime()

    const response = {
      success: true,
      filename,
      storage_path: `${BUCKET}/${FOLDER}/${filename}`,
      manifest,
      pruned_count: pruned,
      duration_ms: durationMs,
    }

    console.log('[weekly-backup] completed:', JSON.stringify({ ...response, manifest: undefined, ...manifest }))

    return new Response(JSON.stringify(response), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[weekly-backup] fatal error:', err)
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
