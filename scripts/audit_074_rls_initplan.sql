-- audit_074_rls_initplan.sql
-- Chạy TRƯỚC khi `supabase db push` migration 074 (SQL Editor / psql / supabase db execute).
-- Chỉ đọc. Ghi lại kết quả để so với verify_074 sau khi apply.

-- 1. Số policy gọi auth.uid()/auth.role()/auth.jwt() chưa bọc (kỳ vọng hôm 2026-10-24: 56)
select count(*) as policies_to_wrap
from pg_policies
where schemaname = 'public'
  and (coalesce(qual, '')       ~ '(?<!SELECT )auth\.(uid|role|jwt)\(\)'
    or coalesce(with_check, '') ~ '(?<!SELECT )auth\.(uid|role|jwt)\(\)');

-- 2. Danh sách chi tiết (bảng, policy, lệnh)
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and (coalesce(qual, '')       ~ '(?<!SELECT )auth\.(uid|role|jwt)\(\)'
    or coalesce(with_check, '') ~ '(?<!SELECT )auth\.(uid|role|jwt)\(\)')
order by tablename, policyname;

-- 3. Khoá ngoại chưa có index (kỳ vọng: 27)
with fk as (
  select c.conname, c.conrelid, c.conkey
  from pg_constraint c join pg_namespace n on n.oid = c.connamespace
  where c.contype = 'f' and n.nspname = 'public'
)
select count(*) as unindexed_fks
from fk
where not exists (
  select 1 from pg_index i
  where i.indrelid = fk.conrelid
    and (i.indkey::int2[])[0:array_length(fk.conkey, 1) - 1] = fk.conkey
);

-- 4. Backup chưa tồn tại (kỳ vọng: true – migration sẽ tạo)
select to_regclass('public.rls_policy_backup_20261024') is null as backup_not_yet_created;
