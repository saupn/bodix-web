-- DO NOT RUN AUTOMATICALLY.
-- ============================================================================
-- Rollback cho migration 068_clean_workout_templates.sql
--
-- Khôi phục 3 cột version cũ (hard/light/recovery_version) từ backup table, khôi
-- phục sessions.exercises (Phase 4), và gỡ cột `exercises`. CHẠY THỦ CÔNG.
--
-- Điều kiện: backup public.workout_templates_backup_20260604 và
-- public.sessions_backup_20260604 phải tồn tại (do migration 068 tạo).
-- KHÔNG dùng TRUNCATE — chỉ ALTER cột + UPDATE từ backup.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Safety check: backup phải tồn tại, nếu không thì abort.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.workout_templates_backup_20260604') IS NULL THEN
    RAISE EXCEPTION 'Rollback 068 abort: backup table workout_templates_backup_20260604 không tồn tại';
  END IF;
  IF to_regclass('public.sessions_backup_20260604') IS NULL THEN
    RAISE EXCEPTION 'Rollback 068 abort: backup table sessions_backup_20260604 không tồn tại';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- STEP 0 — Khôi phục sessions.exercises từ backup (Phase 4 revert).
-- ---------------------------------------------------------------------------
UPDATE public.sessions s
SET exercises = b.exercises
FROM public.sessions_backup_20260604 b
WHERE s.id = b.id;

-- ---------------------------------------------------------------------------
-- STEP 1 — Tái tạo 3 cột cũ (nếu chưa có).
-- ---------------------------------------------------------------------------
ALTER TABLE public.workout_templates ADD COLUMN IF NOT EXISTS hard_version     jsonb;
ALTER TABLE public.workout_templates ADD COLUMN IF NOT EXISTS light_version    jsonb;
ALTER TABLE public.workout_templates ADD COLUMN IF NOT EXISTS recovery_version jsonb;

-- ---------------------------------------------------------------------------
-- STEP 2 — Khôi phục giá trị từ backup (match theo id).
-- ---------------------------------------------------------------------------
UPDATE public.workout_templates wt
SET hard_version     = b.hard_version,
    light_version    = b.light_version,
    recovery_version = b.recovery_version
FROM public.workout_templates_backup_20260604 b
WHERE wt.id = b.id;

-- ---------------------------------------------------------------------------
-- STEP 3 — Gỡ cột exercises (cột do migration 068 thêm).
--   Lưu ý: nếu đã seed 6W/12W vào `exercises` ở migration sau, KHÔNG chạy bước
--   này — comment lại để giữ dữ liệu advanced.
-- ---------------------------------------------------------------------------
ALTER TABLE public.workout_templates DROP COLUMN IF EXISTS exercises;

-- ---------------------------------------------------------------------------
-- STEP 4 — Verify: 3 cột cũ đã có lại, khớp số dòng có version với backup.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_now integer;
  v_bak integer;
BEGIN
  PERFORM 1 FROM information_schema.columns
   WHERE table_schema='public' AND table_name='workout_templates' AND column_name='hard_version';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Rollback 068 verify: hard_version chưa được tái tạo';
  END IF;

  SELECT count(*) INTO v_now FROM public.workout_templates WHERE hard_version IS NOT NULL;
  SELECT count(*) INTO v_bak FROM public.workout_templates_backup_20260604 WHERE hard_version IS NOT NULL;
  IF v_now <> v_bak THEN
    RAISE EXCEPTION 'Rollback 068 verify: hard_version restore mismatch (now=%, backup=%)', v_now, v_bak;
  END IF;

  -- sessions.exercises phải khớp lại backup (không còn dòng lệch).
  SELECT count(*) INTO v_now
  FROM public.sessions s
  JOIN public.sessions_backup_20260604 b ON b.id = s.id
  WHERE s.exercises IS DISTINCT FROM b.exercises;
  IF v_now > 0 THEN
    RAISE EXCEPTION 'Rollback 068 verify: % sessions chưa khớp backup', v_now;
  END IF;
END $$;

COMMIT;
