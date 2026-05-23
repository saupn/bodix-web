-- Monitoring queries for discount_fallback_log.
--
-- Expected behavior AFTER migration 052 is applied:
--   - No new rows should appear in discount_fallback_log.
--   - If new rows appear, a code-creation path is bypassing the DB defaults
--     (referee_reward_type / referee_reward_value). Investigate the source.
--
-- Usage:
--   - Manual: paste any of these blocks into the Supabase SQL editor.
--   - Automated: wire into the weekly-report Edge Function later.

-- ── 1. Daily fallback count, last 7 days, in Vietnam time ───────────────────
SELECT
  DATE(created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') AS date_vn,
  code_type,
  COUNT(*) AS fallback_count
FROM public.discount_fallback_log
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY date_vn, code_type
ORDER BY date_vn DESC, code_type;

-- ── 2. Top offending code IDs, last 30 days (target backfill) ──────────────
SELECT
  code_id,
  code_type,
  code_masked,
  COUNT(*) AS fallback_count,
  MAX(created_at) AS last_seen,
  MIN(created_at) AS first_seen
FROM public.discount_fallback_log
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY code_id, code_type, code_masked
ORDER BY fallback_count DESC
LIMIT 20;

-- ── 3. Fallback by program (which checkout flow hit it most) ───────────────
SELECT
  program_slug,
  code_type,
  COUNT(*) AS fallback_count,
  MAX(created_at) AS last_seen
FROM public.discount_fallback_log
WHERE created_at >= NOW() - INTERVAL '30 days'
  AND program_slug IS NOT NULL
GROUP BY program_slug, code_type
ORDER BY fallback_count DESC;

-- ── 4. Acceptance check: should return 0 row in the days after migration 052 ─
SELECT
  COUNT(*) AS new_fallbacks_since_backfill
FROM public.discount_fallback_log
WHERE created_at >= '2026-05-23'::timestamptz;

-- ── 5. Join with referral_codes to find still-broken DB rows ───────────────
-- Any code_id here means: the migration created the row but its reward fields
-- are STILL missing (should be impossible after migration 052 verify block,
-- but useful as a sanity check).
SELECT
  fl.code_id,
  fl.code_masked,
  fl.code_type,
  rc.referee_reward_type,
  rc.referee_reward_value,
  COUNT(*) AS hits,
  MAX(fl.created_at) AS last_seen
FROM public.discount_fallback_log fl
LEFT JOIN public.referral_codes rc ON rc.id = fl.code_id
WHERE fl.created_at >= NOW() - INTERVAL '7 days'
  AND fl.code_type IN ('referral', 'affiliate')
GROUP BY fl.code_id, fl.code_masked, fl.code_type, rc.referee_reward_type, rc.referee_reward_value
ORDER BY hits DESC;
