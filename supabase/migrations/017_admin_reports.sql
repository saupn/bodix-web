-- Migration: 017_admin_reports

create table public.admin_reports (
  id          uuid primary key default gen_random_uuid(),
  report_type text not null,   -- 'weekly_founder', 'monthly_summary', etc.
  report_date date not null,
  data        jsonb,
  sent_at     timestamptz,
  created_at  timestamptz default now()
);

create index idx_admin_reports_type_date on public.admin_reports(report_type, report_date desc);

-- No RLS — admin-only table, access only via service_role
