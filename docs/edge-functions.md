# BodiX Edge Functions

All Edge Functions run on Deno (Supabase Edge Runtime). They are protected by a per-function secret passed in the `x-function-secret` HTTP header.

Deployment:
```bash
npx supabase functions deploy <function-name>
```

---

## Functions Overview

| Function | Cron (UTC) | ICT Time | Secret Env Var |
|---|---|---|---|
| morning-reminder | `0 0 * * *` | 07:00 daily | `MORNING_REMINDER_SECRET` |
| evening-confirmation | `0 14 * * *` | 21:00 daily | `EVENING_CONFIRMATION_SECRET` |
| dropout-scanner | `0 15 * * *` | 22:00 daily | `DROPOUT_SCANNER_SECRET` |
| trial-expiration | `0 * * * *` | every hour | `TRIAL_EXPIRATION_SECRET` |
| weekly-review-reminder | `0 1 * * 0` | 08:00 Sunday | `WEEKLY_REVIEW_REMINDER_SECRET` |
| midprogram-trigger | `0 1 * * *` | 08:00 daily | `MIDPROGRAM_TRIGGER_SECRET` |
| weekly-report | `0 2 * * 1` | 09:00 Monday | `WEEKLY_REPORT_SECRET` |

---

## 1. morning-reminder

**Purpose:** Send morning workout reminders to active users who opted in.

**Cron:** `0 0 * * *` (07:00 ICT)

**Logic:**
1. Paginate through all active enrollments in active cohorts (batch size: 50)
2. Filter to users who have `morning_reminder = true` in notification_preferences
3. Exclude users already sent a `morning_reminder` nudge today
4. For each eligible user, select a message variant (deterministic hash on userId+date, avoids repeating yesterday's variant)
5. Send via email and/or Zalo ZNS based on `preferred_channel`
6. Insert nudge_log record (always — prevents retry storms)

**Message variants:** 5 variants (mr_1 through mr_5), personalised with name, day_number, workout_title, streak, cohort count.

**Sends:** Email via Resend, Zalo ZNS `morning_reminder` template

**Nudge type:** `morning_reminder`

---

## 2. evening-confirmation

**Purpose:** Remind users to check in if they haven't done so by 21:00.

**Cron:** `0 14 * * *` (21:00 ICT)

**Logic:**
1. Paginate active enrollments in active cohorts
2. Filter to users with `evening_confirmation = true`
3. **Exclude users who already checked in today** (core logic — avoids annoying active users)
4. Exclude users already sent `evening_confirmation` today
5. Select variant (3 variants: ec_1, ec_2, ec_3)
6. Send via preferred channel

**Sends:** Email, Zalo ZNS `evening_confirmation` template

**Nudge type:** `evening_confirmation`

---

## 3. dropout-scanner

**Purpose:** Detect at-risk users, create dropout signals and rescue interventions, auto-pause abandoned enrollments.

**Cron:** `0 15 * * *` (22:00 ICT, after evening-confirmation)

**Logic:**
1. Track previous day's nudge effectiveness (mark `led_to_checkin = true` for nudges followed by a check-in)
2. Paginate all active enrollments (batch size: 50)
3. For each batch, fetch supporting data in parallel: streaks, last 5 check-ins, existing signals, existing rescues, already-sent nudges today
4. For each enrollment, compute risk score (0–100) and plan actions
5. Execute batch: insert signals, rescues, pause enrollments, send nudges

**Risk Score Formula:**
- Days missed 1: +15
- Days missed 2: +35
- Days missed 3+: +55
- Low feeling trend (avg < 2.5): +15
- Downgrade pattern (last 5 all light/recovery): +10
- Breakdown point (D3, D7, D14): +8–10
- Excessive skips (>3): +10
- Max: 100

**Risk Categories:**
- 0–19: `healthy` — no action
- 20–49: `at_risk` — record signal
- 50–79: `high_risk` — send rescue nudge
- 80–100: `critical` — urgent rescue

**Actions by missed days:**
- missed 1 day: create `missed_1_day` signal only
- missed 2 days: create signal + rescue intervention + send rescue_soft or rescue_urgent message
- missed 3+ days: create signal + rescue_critical message + auto-pause after 7+ days missed

**Auto-pause:** If `days_since_last_checkin >= 7`, enrollment status → `paused`

**Nudge types:** `rescue_soft`, `rescue_urgent`, `rescue_critical`

**Rescue variants:**
- rescue_soft: 2 variants (rs_1, rs_2) — gentle encouragement
- rescue_urgent: 2 variants (ru_1, ru_2) — stronger motivation
- rescue_critical: 1 variant (rc_1) — final outreach

Also creates `in_app` notification for rescue messages.

---

## 4. trial-expiration

**Purpose:** Notify users when their 3-day trial is expiring and handle trial expiry.

**Cron:** `0 * * * *` (every hour)

**Logic:**
1. Find users whose `trial_ends_at` is within the next 24 hours — send `trial_reminder_24h` notification
2. Find users whose `trial_ends_at` is within the next 6 hours — send `trial_reminder_6h` notification
3. Find users whose `trial_ends_at` has passed and enrollment is still `trial` — set enrollment to `dropped` or `expired`
4. Deduplicate: only send each notification type once per trial

**Notifications created:**
- `trial_reminder_24h` — 24 hours before expiry
- `trial_reminder_6h` — 6 hours before expiry
- `trial_expired` — after expiry

---

## 5. weekly-review-reminder

**Purpose:** Remind users to submit their weekly review on Sunday/Monday.

**Cron:** `0 1 * * 0` (08:00 ICT Sunday)

**Logic:**
1. Find active enrollments where `current_day >= 7` (at least 1 week completed)
2. Check if review for `current_week = floor(current_day / 7)` is already submitted
3. Send in-app notification + email/Zalo for pending reviews

**Notification type:** `weekly_review_reminder`

---

## 6. midprogram-trigger

**Purpose:** Notify users when they reach the midpoint of their program.

**Cron:** `0 1 * * *` (08:00 ICT daily)

**Logic:**
1. Find active enrollments where `current_day == ceil(duration_days / 2)`
2. Check if mid-program reflection already submitted
3. Send notification prompting mid-program reflection
4. Create `halfway` milestone if not already earned

**Notification type:** `midprogram_reflection_reminder`

---

## 7. weekly-report

**Purpose:** Send weekly summary report to admin(s).

**Cron:** `0 2 * * 1` (09:00 ICT Monday)

**Logic:**
1. Aggregate stats for the past week: new enrollments, check-ins, completions, dropout rate, revenue
2. Send email report to admin(s) with `role = 'admin'` in profiles

---

## Shared Utilities (`supabase/functions/_shared/`)

### supabase-admin.ts
```ts
createAdminClient() // Uses SUPABASE_SERVICE_ROLE_KEY, bypasses RLS
```

### email.ts
```ts
sendEmail(userId: string, subject: string, body: string) // Via Resend API
```

### zalo.ts
```ts
sendZaloZNS(phone: string, templateType: string, params: Record<string, string>)
// Uses ZALO_OA_ACCESS_TOKEN + template IDs from env
```

---

## Setting Up Cron Jobs

### Option A: Supabase Dashboard
Go to **Edge Functions → [function name] → Schedule** and enter the cron expression.

### Option B: pg_cron (Pro plan)
```sql
select cron.schedule(
  'morning-reminder',
  '0 0 * * *',
  $$ select net.http_post(
    url     := 'https://<project-ref>.supabase.co/functions/v1/morning-reminder',
    headers := '{"x-function-secret": "<MORNING_REMINDER_SECRET>"}'::jsonb
  ) $$
);
```

---

## Environment Variables (Edge Function Secrets)

Set via Supabase Dashboard → Edge Functions → Secrets (or `supabase secrets set KEY=value`):

| Variable | Used By |
|---|---|
| `SUPABASE_URL` | All (auto-injected) |
| `SUPABASE_SERVICE_ROLE_KEY` | All (auto-injected) |
| `MORNING_REMINDER_SECRET` | morning-reminder |
| `EVENING_CONFIRMATION_SECRET` | evening-confirmation |
| `DROPOUT_SCANNER_SECRET` | dropout-scanner |
| `TRIAL_EXPIRATION_SECRET` | trial-expiration |
| `WEEKLY_REVIEW_REMINDER_SECRET` | weekly-review-reminder |
| `MIDPROGRAM_TRIGGER_SECRET` | midprogram-trigger |
| `WEEKLY_REPORT_SECRET` | weekly-report |
| `RESEND_API_KEY` | All (email sending) |
| `FROM_EMAIL` | All (email sender) |
| `FOUNDER_EMAIL` | weekly-report |
| `ZALO_OA_ACCESS_TOKEN` | All (Zalo ZNS) |
| `ZALO_ZNS_TEMPLATE_MORNING` | morning-reminder |
| `ZALO_ZNS_TEMPLATE_RESCUE` | dropout-scanner |

---

## Invoking Manually (Testing)

```bash
# From terminal — replace with actual values
curl -X POST \
  'https://<project-ref>.supabase.co/functions/v1/morning-reminder' \
  -H 'x-function-secret: <MORNING_REMINDER_SECRET>'
```

---

## Response Format

All functions return:
```json
{
  "success": true,
  "processed_at": "2026-03-07T00:00:00.000Z",
  "date": "2026-03-07",
  "batches": 2,
  "results": { "sent": 45, "skipped": 3, "errors": 2 }
}
```

On error:
```json
{ "success": false, "error": "Error description" }
```
