# BodiX — CLAUDE.md

## Tổng quan
BodiX là nền tảng fitness theo triết lý Completion-first. Ba chương trình:
- **BodiX 21** — 21 ngày, 990.000đ (`bodix-21`)
- **BodiX 6W** — 42 ngày, 1.990.000đ (`bodix-6w`)
- **BodiX 12W** — 84 ngày, 3.490.000đ (`bodix-12w`)

Mỗi tuần: 5 buổi chính (Hard/Light) + 1 Recovery + 1 linh hoạt.

## Tech Stack
- **Next.js 16.1.6** (App Router) + TypeScript strict + Tailwind CSS v4
- **Supabase** (PostgreSQL + Auth + Realtime + Edge Functions + Storage)
- **Vercel** (hosting + Analytics + Speed Insights)
- **Sentry** (error monitoring)

## Cấu trúc thư mục
```
app/                    → Next.js App Router pages
  (auth)/               → Auth pages (login, onboarding)
  (dashboard)/          → Dashboard pages (program, checkin, community...)
  api/                  → API route handlers
  p/[slug]/             → Public landing pages per program
  r/[code]/             → Referral landing pages
components/             → React components
  landing/              → Landing page sections per program
  dashboard/            → Dashboard UI components
  checkout/             → Checkout flow
  program/              → Program/workout UI
  rescue/               → Rescue intervention UI
  completion/           → Completion/milestone UI
  ui/                   → Shared UI primitives
lib/
  supabase/             → client.ts, server.ts, service.ts, middleware.ts
  completion/           → milestones.ts, fetch-stats.ts
  nudging/              → templates.ts, template-engine.ts, variant-selector.ts
  rescue/               → fetch-status.ts
  referral/             → post-milestone.ts
  payment/              → utils.ts
  trial/                → utils.ts
  user/                 → status.ts
  admin/                → verify-admin.ts
  middleware/           → rate-limit.ts
  validation/           → schemas.ts (Zod)
  monitoring/           → index.ts (Sentry custom tracking)
  cache/                → index.ts
supabase/
  migrations/           → SQL migrations (numbered, sequential)
  functions/            → Deno Edge Functions
docs/                   → API reference, Flutter setup, data models
```

## Quy ước code
- TypeScript strict mode — không dùng `any` nếu không cần thiết
- Tailwind CSS cho styling — không dùng CSS modules
- Server Components mặc định; chỉ `"use client"` khi cần interactivity
- Supabase client-side: `lib/supabase/client.ts`
- Supabase server-side (API routes): `lib/supabase/server.ts`
- Supabase service role (bypass RLS): `lib/supabase/service.ts`
- Mọi table đều có RLS policies; admin access qua `service_role`
- Zod validation ở tất cả API routes (`lib/validation/schemas.ts`)
- Rate limiting qua `lib/middleware/rate-limit.ts`

---

## Database Tables (27 tables)

### Auth & Profiles
| Table | Mô tả |
|-------|-------|
| `profiles` | User profile — full_name, phone, phone_verified, date_of_birth, gender, fitness_goal, trial_started_at, trial_ends_at, role |
| `phone_otps` | OTP verification — phone, otp_code, expires_at, verified |

### Program Engine
| Table | Mô tả |
|-------|-------|
| `programs` | 3 chương trình — slug, name, duration_days, price_vnd, features (jsonb) |
| `cohorts` | Đợt chạy — program_id, start_date, end_date, max_members, status (upcoming/active/completed) |
| `enrollments` | User tham gia — user_id, program_id, cohort_id, status (trial/pending_payment/active/paused/completed/dropped), current_day, amount_paid, referral_code_id, referral_discount_amount |
| `workout_templates` | Bài tập theo ngày — program_id, day_number, week_number, workout_type (main/recovery/flexible), hard_version (jsonb), light_version (jsonb) |
| `trial_activities` | Hoạt động trong 3 ngày trial — activity_type (view_program/view_workout/try_workout/complete_trial_day) |

### Completion Engine
| Table | Mô tả |
|-------|-------|
| `daily_checkins` | Check-in hàng ngày — enrollment_id, day_number, workout_date, mode (hard/light/recovery/skip), feeling (1-5), duration_minutes |
| `streaks` | Streak tracking — current_streak, longest_streak, total_completed/hard/light/recovery/skip_days, last_checkin_date |
| `dropout_signals` | Tín hiệu bỏ cuộc — signal_type (missed_1_day/missed_2_days/missed_3_plus_days/downgrade_pattern/low_feeling_trend/skip_pattern/d3_risk/d7_risk/d14_risk), risk_score (0-100), resolved |
| `completion_milestones` | Thành tích — milestone_type (streak_3/7/14/21/week_complete/halfway/final_week/program_complete/all_hard/first_checkin/comeback) |

### Nudging System
| Table | Mô tả |
|-------|-------|
| `notifications` | Tất cả thông báo — type, channel (email/zalo/push/in_app), is_read |
| `notification_preferences` | Tuỳ chọn thông báo — morning_reminder, evening_confirmation, rescue_messages, preferred_channel, morning_time, evening_time |
| `nudge_logs` | Lịch sử gửi nudge — nudge_type, channel, delivered, opened, led_to_checkin |
| `rescue_interventions` | Log can thiệp rescue — trigger_reason, action_taken, outcome (user_returned/user_continued_light/user_paused/user_dropped/pending) |
| `ab_test_assignments` | A/B test variants — user_id, test_name, variant |

### Review System
| Table | Mô tả |
|-------|-------|
| `weekly_reviews` | Review cuối tuần — fatigue_level, progress_feeling, difficulty_rating, week_completion_rate, system_suggestion, intensity_adjustment |
| `mid_program_reflections` | Phản ánh giữa chương trình — overall_progress (1-10), visible_changes, wants_intensity_change, recommendation_score (NPS 0-10) |
| `progress_photos` | Ảnh tiến trình — photo_type (before/midpoint/after/weekly), photo_url, is_public |
| `community_posts` | Bài đăng trong cohort — post_type (completion_share/milestone_share/progress_photo/motivation/question/program_complete) |
| `community_reactions` | Reaction — reaction_type (like/fire/clap/heart), unique per user per post |

### Referral & Affiliate
| Table | Mô tả |
|-------|-------|
| `referral_codes` | Code giới thiệu — code_type (referral/affiliate), commission_rate, reward_type, total_clicks/signups/conversions |
| `referral_tracking` | Hành trình giới thiệu — status (clicked/signed_up/trial_started/converted/completed/expired/fraudulent) |
| `referral_rewards` | Phần thưởng — reward_type (credit/discount_percent/discount_fixed/free_days/commission), status (pending/approved/paid/rejected) |
| `user_credits` | Ví credit — amount, balance_after, transaction_type (referral_reward/affiliate_commission/purchase_discount/withdrawal/admin_adjustment) |
| `affiliate_profiles` | Affiliate info — affiliate_tier (basic 15%/silver 18%/gold 20%/platinum 25%), bank info, total_earned, pending_balance |

### Admin
| Table | Mô tả |
|-------|-------|
| `admin_reports` | Báo cáo admin — report_type (weekly_founder/monthly_summary), data (jsonb) |

---

## Materialized Views (4 views)

| View | Refresh | Mô tả |
|------|---------|-------|
| `mv_cohort_analytics` | Mỗi 2 giờ | Cohort stats: completion_rate, d7_adherence, d14_adherence, avg_current_streak |
| `mv_program_analytics` | Mỗi 2 giờ | Program stats: overall_completion_rate, total_revenue, visible_change_rate, NPS |
| `mv_upgrade_funnel` | Mỗi 2 giờ | Upgrade rates: 21→6W, 6W→12W |
| `mv_monthly_revenue` | Mỗi 2 giờ | Monthly revenue: total, referral_share_percent, total_discount_given |

Refresh function: `public.refresh_analytics_views()` — chạy bằng pg_cron `0 */2 * * *`.

---

## Edge Functions (8 functions)

| Function | Cron (UTC) | ICT | Secret env var | Mô tả |
|----------|-----------|-----|----------------|-------|
| `morning-reminder` | `0 0 * * *` | 7:00 SA hàng ngày | `MORNING_REMINDER_SECRET` | 5 template variants, djb2 hash selection |
| `evening-confirmation` | `0 14 * * *` | 9:00 PM hàng ngày | `EVENING_CONFIRMATION_SECRET` | Bỏ qua user đã check-in |
| `dropout-scanner` | `0 23 * * *` | 6:00 SA hàng ngày | `DROPOUT_SCANNER_SECRET` | Risk scoring 0-100, auto-pause 7+ ngày miss |
| `trial-expiration` | `0 1,9 * * *` | 8 SA & 4 CH | `TRIAL_EXPIRATION_SECRET` | Nhắc 24h và 6h trước khi hết trial |
| `weekly-review-reminder` | `0 0 * * 6` | 7:00 SA thứ Bảy | `WEEKLY_REVIEW_REMINDER_SECRET` | Nhắc review cuối tuần |
| `midprogram-trigger` | `0 1 * * *` | 8:00 SA hàng ngày | `MIDPROGRAM_TRIGGER_SECRET` | Trigger mid-program reflection tại ngày giữa |
| `weekly-report` | `0 0 * * 0` | 7:00 SA Chủ nhật | `WEEKLY_REPORT_SECRET` | Báo cáo tuần cho founder |
| `weekly-backup` | `0 20 * * 6` | 3:00 SA Chủ nhật | `WEEKLY_BACKUP_SECRET` | Export 4 tables → JSON → Storage `backups/weekly/`, giữ 4 bản |

Tất cả functions được bảo vệ bằng header `x-function-secret`.
Shared utility: `supabase/functions/_shared/supabase-admin.ts`.

---

## API Routes Map

### Auth
| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/api/auth/send-otp` | Gửi OTP SMS (rate limit: 3/10min) |
| POST | `/api/auth/verify-otp` | Xác minh OTP + đánh dấu phone_verified |
| POST | `/api/auth/complete-onboarding` | Lưu thông tin onboarding |
| GET | `/auth/callback` | Supabase OAuth callback |

### Trial
| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/api/trial/start` | Bắt đầu 3-ngày trial |
| GET | `/api/trial/status` | Trạng thái trial (active/expired/not_started) |
| GET | `/api/trial/workouts` | Danh sách bài tập trial |
| GET | `/api/trial/workout/[day]` | Bài tập ngày cụ thể |
| POST | `/api/trial/activity` | Log trial activity |

### Program
| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/program/active` | Enrollment đang active của user |
| GET | `/api/program/workout/[day]` | Bài tập ngày N của chương trình |
| POST | `/api/program/complete` | Hoàn thành chương trình |

### Check-in
| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/api/checkin` | Nộp check-in hàng ngày |

### Completion
| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/completion/my-stats` | Streak, milestones, tổng kết cá nhân |
| GET | `/api/completion/history` | Lịch sử check-in |
| GET | `/api/completion/cohort-board` | Bảng xếp hạng cohort |

### Rescue
| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/rescue/status` | Trạng thái rescue hiện tại |
| POST | `/api/rescue/acknowledge` | Xác nhận đã đọc rescue message |

### Reviews
| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/reviews/weekly/pending` | Danh sách tuần chưa review |
| GET | `/api/reviews/weekly/context` | Context cho weekly review form |
| POST | `/api/reviews/weekly` | Nộp weekly review |
| GET | `/api/reviews/mid-program/context` | Context cho mid-program reflection |
| POST | `/api/reviews/mid-program` | Nộp mid-program reflection |

### Photos & Community
| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/photos` | Danh sách ảnh tiến trình |
| POST | `/api/photos/upload` | Upload progress photo |
| GET | `/api/community/posts` | Bài đăng trong cohort |
| POST | `/api/community/posts` | Tạo bài đăng |
| POST | `/api/community/posts/suggest` | AI gợi ý nội dung bài đăng |
| GET | `/api/community/posts/summary` | Tóm tắt hoạt động cohort |
| POST | `/api/community/posts/[id]/reactions` | Thêm/xoá reaction |
| GET/POST | `/api/community/reactions` | Reactions |
| GET | `/api/community/media` | Media trong cohort |
| POST | `/api/community/upload` | Upload media |

### Notifications
| Method | Path | Mô tả |
|--------|------|-------|
| GET/PUT | `/api/notifications/preferences` | Tuỳ chọn thông báo |
| GET | `/api/notifications/community-unread` | Đếm thông báo chưa đọc |

### Checkout & Payment
| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/api/checkout/create` | Tạo đơn thanh toán |
| POST | `/api/checkout/confirm` | Xác nhận thanh toán (manual) |
| POST | `/api/webhooks/payment` | Webhook từ VNPay/Stripe |

### Referral
| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/referral/code` | Lấy hoặc tạo referral code |
| POST | `/api/referral/track` | Ghi click referral |
| GET | `/api/referral/tracking` | Lịch sử giới thiệu |
| POST | `/api/referral/validate` | Validate code trước checkout |
| POST | `/api/referral/anti-fraud` | Anti-fraud check (INTERNAL_API_SECRET) |

### Affiliate
| Method | Path | Mô tả |
|--------|------|-------|
| POST | `/api/affiliate/apply` | Đăng ký làm affiliate |
| GET | `/api/affiliate/status` | Trạng thái duyệt |
| GET | `/api/affiliate/profile` | Profile & bank info |
| GET | `/api/affiliate/dashboard` | Stats: earnings, conversions |
| POST | `/api/affiliate/withdraw` | Yêu cầu rút tiền |

### Admin — Nudging
| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/admin/nudging/overview` | Tổng quan nudging |
| GET | `/api/admin/nudging/risk-monitor` | Users có risk score cao |
| GET | `/api/admin/nudging/nudge-logs` | Log nudge đã gửi |
| GET | `/api/admin/nudging/rescue-history` | Lịch sử rescue |
| POST | `/api/admin/nudging/manual-intervention` | Can thiệp thủ công |

### Admin — Referral & Affiliate
| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/admin/referral/overview` | Tổng quan referral |
| GET | `/api/admin/referral/codes` | Tất cả referral codes |
| GET | `/api/admin/referral/conversions` | Conversion tracking |
| GET | `/api/admin/affiliate` | Danh sách affiliates |
| PUT | `/api/admin/affiliate/update` | Cập nhật tier/status |
| GET | `/api/admin/affiliate/withdrawals` | Yêu cầu rút tiền chờ duyệt |
| POST | `/api/admin/affiliate/payouts` | Xác nhận đã thanh toán |

### Admin — Analytics & Users
| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/admin/analytics/overview` | Dashboard tổng quan |
| GET | `/api/admin/analytics/cohorts` | Danh sách cohorts + stats |
| GET | `/api/admin/analytics/cohorts/[id]` | Chi tiết cohort |
| GET | `/api/admin/analytics/revenue` | Doanh thu theo tháng |
| GET | `/api/admin/analytics/dropout` | Dropout analysis |
| GET | `/api/admin/analytics/funnel` | Upgrade funnel |
| GET | `/api/admin/users` | Danh sách users |
| GET | `/api/admin/users/[id]` | Chi tiết user |

### Health
| Method | Path | Mô tả |
|--------|------|-------|
| GET | `/api/health` | Health check (DB ping) — dùng với UptimeRobot |

---

## Key Business Logic Locations

| Logic | File |
|-------|------|
| Milestone detection & award | `lib/completion/milestones.ts` |
| Streak & stats computation | `lib/completion/fetch-stats.ts` |
| Nudge message templates | `lib/nudging/templates.ts` |
| Template variable rendering | `lib/nudging/template-engine.ts` |
| A/B variant selection (djb2) | `lib/nudging/variant-selector.ts` |
| Rescue status fetch | `lib/rescue/fetch-status.ts` |
| Post-purchase referral processing | `lib/referral/post-milestone.ts` |
| Payment helpers (VNPay/Stripe) | `lib/payment/utils.ts` |
| Trial expiry helpers | `lib/trial/utils.ts` |
| User status resolution | `lib/user/status.ts` |
| Admin role verification | `lib/admin/verify-admin.ts` |
| Rate limiting (sliding window) | `lib/middleware/rate-limit.ts` |
| Zod validation schemas | `lib/validation/schemas.ts` |
| Sentry custom event tracking | `lib/monitoring/index.ts` |
| Cache utilities | `lib/cache/index.ts` |
| Risk scoring & dropout signals | `supabase/functions/dropout-scanner/index.ts` |

---

## Environment Variables Required

### Public (browser-safe — NEXT_PUBLIC_ prefix)
| Variable | Mô tả |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL Supabase project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key (safe to expose) |
| `NEXT_PUBLIC_APP_URL` | https://bodix.vn |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN (read-only, safe to expose) |

### Server-only (never NEXT_PUBLIC_)
| Variable | Mô tả |
|----------|-------|
| `SUPABASE_SERVICE_ROLE_KEY` | Bypass RLS — server-side only |
| `SMS_PROVIDER_API_KEY` | SpeedSMS / eSMS API key |
| `SMS_SENDER_ID` | SMS sender ID (mặc định: BodiX) |
| `ZALO_OA_ACCESS_TOKEN` | Zalo OA token cho ZNS |
| `ZALO_ZNS_TEMPLATE_MORNING` | Template ID tin nhắn sáng |
| `ZALO_ZNS_TEMPLATE_RESCUE` | Template ID tin nhắn rescue |
| `VNPAY_HASH_SECRET` | VNPay hash secret |
| `VNPAY_TMN_CODE` | VNPay TMN code |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret |
| `RESEND_API_KEY` | Resend email API key |
| `FROM_EMAIL` | noreply@bodix.vn |
| `FOUNDER_EMAIL` | founder@bodix.vn |
| `INTERNAL_API_SECRET` | Bảo vệ `/api/referral/anti-fraud` và internal routes |

### Build-time only
| Variable | Mô tả |
|----------|-------|
| `SENTRY_AUTH_TOKEN` | Upload source maps (CI build) |
| `SENTRY_ORG` | Sentry org slug |
| `SENTRY_PROJECT` | bodix-web |

### Edge Function Secrets (Supabase Dashboard → Edge Functions → Secrets)
| Variable | Function |
|----------|----------|
| `DROPOUT_SCANNER_SECRET` | dropout-scanner |
| `TRIAL_EXPIRATION_SECRET` | trial-expiration |
| `MORNING_REMINDER_SECRET` | morning-reminder |
| `EVENING_CONFIRMATION_SECRET` | evening-confirmation |
| `WEEKLY_REVIEW_REMINDER_SECRET` | weekly-review-reminder |
| `MIDPROGRAM_TRIGGER_SECRET` | midprogram-trigger |
| `WEEKLY_REPORT_SECRET` | weekly-report |
| `WEEKLY_BACKUP_SECRET` | weekly-backup |

---

## Flow người dùng
1. Landing (`/p/[slug]`) → Đăng ký (email/Google) → Verify phone OTP
2. Onboarding (date_of_birth, gender, fitness_goal) → Trial 3 ngày
3. Nhận thông báo mua chương trình → Checkout → Thanh toán
4. Vào cohort → `enrollment.status = 'active'` → `streaks` row tạo tự động (trigger)
5. Daily check-in → streak update → milestone check → nudge follow-up
6. Rescue nếu miss 2+ ngày; auto-pause nếu miss 7+ ngày
7. Weekly review cuối mỗi tuần; mid-program reflection ở ngày giữa
8. Hoàn thành chương trình → completion milestone → community share → upsell chương trình tiếp
