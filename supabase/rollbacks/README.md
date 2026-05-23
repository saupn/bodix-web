# supabase/rollbacks

This directory holds **manual rollback scripts** for migrations in
`supabase/migrations/`. Files here are **NOT picked up by `supabase db push`**
and will **never be applied automatically** — that is the entire point of
keeping them out of `supabase/migrations/`.

## When to use a rollback script

Only when a migration has been applied to production and you have decided
the change must be reverted (data integrity issue, wrong business rule,
emergency). For schema mistakes, prefer writing a new forward migration
that fixes the previous one instead of rolling back.

## How to run one

Manually, against the target database, with `ON_ERROR_STOP=1` so a failing
verify block aborts the transaction:

```bash
psql "<DATABASE_URL>" -v ON_ERROR_STOP=1 \
  -f supabase/rollbacks/rollback_NNN_<description>.sql
```

Or via the Supabase Studio SQL editor: paste the file contents and run.

Each rollback file:

1. **Must start with `-- DO NOT RUN AUTOMATICALLY.`** so any grep or CI check
   can detect a misplacement.
2. **Must check that backup tables exist** before touching live data, and
   `RAISE EXCEPTION` if they do not.
3. **Must be wrapped in `BEGIN/COMMIT`** so a failure leaves no partial state.
4. **Must include a verify block** that compares row counts/values against
   the backup and raises if they disagree.
5. **Must NOT use `TRUNCATE`** on tables that have inbound FK references.
   Use targeted `UPDATE` / `DELETE WHERE id IN (...)` instead, with neutralise
   fallback for rows that are FK-referenced (clear reward fields + set
   `is_active=false`) rather than failing.

## Naming

Use the `rollback_` prefix so Supabase CLI parsers (which expect a numeric
version prefix on each file in `supabase/migrations/`) never mistake a file
here for a real migration if it gets accidentally copied:

- ✅ `rollback_052_backfill_discount_data.sql`
- ❌ `052_backfill_discount_data_rollback.sql` (numeric prefix → CLI may parse as migration)

## Lifecycle

- Backup tables created by the forward migration (`<table>_backup_YYYYMMDD`)
  must be retained **at least 30 days** after the forward migration is
  considered stable. Rollback scripts depend on them.
- After the retention window, the team can drop backup tables manually.

## Current rollback files

| File | Reverses | Applied to prod? |
|------|----------|-------------------|
| `rollback_052_backfill_discount_data.sql` | `migrations/052_backfill_discount_data.sql` | NO – do not run unless backfill needs revert |
