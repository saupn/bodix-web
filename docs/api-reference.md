# BodiX API Reference

Base URL: `https://bodix.vn` (production) | `http://localhost:3000` (dev)

All authenticated routes require a valid Supabase session cookie (set automatically by browser/Flutter via `supabase_flutter`). Include `Authorization: Bearer <access_token>` header for Flutter.

---

## Auth

### POST /api/auth/send-otp
Send OTP to phone number. Rate-limited: 10 req/10min per IP.

**Body**
```json
{ "phone": "+84901234567" }
```

**Response 200**
```json
{ "success": true }
```

---

### POST /api/auth/verify-otp
Verify 6-digit OTP sent to phone.

**Body**
```json
{ "phone": "+84901234567", "otp": "123456" }
```

**Response 200**
```json
{ "success": true, "verified": true }
```

**Errors:** `400` invalid OTP | `410` OTP expired | `429` too many attempts

---

### POST /api/auth/complete-onboarding
Set profile details after initial sign-up.

**Body**
```json
{
  "full_name": "Nguyen Van A",
  "date_of_birth": "1995-06-15",
  "gender": "male",
  "fitness_goal": ["giam_can", "tang_co"]
}
```

**Response 200**
```json
{ "success": true, "profile": { "id": "uuid", "full_name": "...", "trial_ends_at": "2026-03-10T..." } }
```

**Fitness goal values:** `giam_can`, `tang_co`, `tang_suc_ben`, `cai_thien_suc_khoe`, `giam_stress`

---

## Trial

### POST /api/trial/start
Start a 3-day free trial for a program.

**Body**
```json
{ "program_id": "uuid" }
```

**Response 201**
```json
{ "success": true, "enrollment": { "id": "uuid", "status": "trial", "trial_ends_at": "..." } }
```

---

### GET /api/trial/status
Get current trial status and enrollment info.

**Response 200**
```json
{
  "is_trial": true,
  "is_expired": false,
  "trial_started_at": "2026-03-07T...",
  "trial_ends_at": "2026-03-10T...",
  "days_remaining": 3,
  "hours_remaining": 72,
  "can_access_content": true,
  "program": { "id": "uuid", "slug": "bodix-21", "name": "BodiX 21", "duration_days": 21, "price_vnd": 990000, "features": [] },
  "enrollment": { "id": "uuid", "program_id": "uuid", "status": "trial", "enrolled_at": "...", "current_day": 0 },
  "activity_summary": { "view_workout": 2, "complete_trial_day": 1 },
  "activities": []
}
```

---

### GET /api/trial/workouts
Get first 3 workout days for active trial.

**Response 200**
```json
{
  "workouts": [
    { "id": "uuid", "day_number": 1, "title": "Ngày 1: Lower Body Basics", "description": "...", "duration_minutes": 30, "workout_type": "main" }
  ]
}
```

---

### GET /api/trial/workout/[day]
Get detailed workout for trial day (1, 2, or 3 only).

**Path param:** `day` = 1 | 2 | 3

**Response 200**
```json
{
  "workout": {
    "id": "uuid", "day_number": 1, "title": "...", "description": "...",
    "duration_minutes": 30, "workout_type": "main",
    "hard_version": { "video_url": "...", "exercises": [] },
    "light_version": { "video_url": "...", "exercises": [] },
    "recovery_version": { "video_url": "...", "exercises": [] }
  },
  "program_id": "uuid",
  "is_completed": false
}
```

---

### POST /api/trial/activity
Track user activity during trial.

**Body**
```json
{
  "program_id": "uuid",
  "activity_type": "view_workout",
  "metadata": { "day_number": 1 }
}
```

**Activity types:** `view_program`, `view_workout`, `try_workout`, `complete_trial_day`

**Response 200**
```json
{ "success": true, "activity": { "id": "uuid", "activity_type": "view_workout", "metadata": {}, "created_at": "..." } }
```

---

## Program

### GET /api/program/active
Get user's active program with today's workout.

**Response 200**
```json
{
  "enrollment": {
    "id": "uuid", "status": "active", "current_day": 5,
    "started_at": "2026-03-01T...",
    "program": { "id": "uuid", "slug": "bodix-21", "name": "BodiX 21", "duration_days": 21 },
    "cohort": { "id": "uuid", "name": "...", "start_date": "2026-03-01", "end_date": "2026-03-22" },
    "workouts": [],
    "today_workout": { "day_number": 5, "title": "...", "duration_minutes": 30 },
    "week_days": []
  }
}
```

---

### GET /api/program/workout/[day]
Get specific workout day details for active enrollment.

**Response 200**
```json
{
  "workout": {
    "id": "uuid", "day_number": 5, "week_number": 1,
    "title": "...", "description": "...", "duration_minutes": 30, "workout_type": "main",
    "hard_version": {}, "light_version": {}, "recovery_version": {}
  },
  "program_id": "uuid",
  "enrollment_id": "uuid",
  "is_completed": false,
  "checkin": null
}
```

---

### POST /api/program/complete
Mark a day as visited/started (advances current_day counter).

**Body**
```json
{ "day": 5 }
```

**Response 200**
```json
{ "success": true, "current_day": 6 }
```

---

## Check-in

### POST /api/checkin
Submit daily check-in. Rate-limited: 20 req/min per user.

**Body**
```json
{
  "enrollment_id": "uuid",
  "day_number": 5,
  "mode": "hard",
  "feeling": 4,
  "feeling_note": "Cảm thấy ổn",
  "duration_minutes": 32
}
```

**Mode values:** `hard` | `light` | `recovery` | `skip`
**Feeling:** 1–5 (1=Rất mệt … 5=Tuyệt vời)

**Response 200**
```json
{
  "checkin": { "id": "uuid", "enrollment_id": "uuid", "day_number": 5, "mode": "hard", "feeling": 4, ... },
  "streak": { "current_streak": 5, "longest_streak": 5, "total_completed_days": 5 },
  "new_milestones": [{ "milestone_type": "streak_3", "achieved_at": "..." }],
  "completion_rate": 71.4
}
```

**Errors:** `409` already checked in today | `400` future date | `400` grace period expired

---

## Completion

### GET /api/completion/my-stats
Get personal completion stats.

**Response 200**
```json
{
  "streak": { "current_streak": 5, "longest_streak": 7, "total_completed_days": 12 },
  "checkins": [],
  "milestones": [],
  "completion_rate": 57.1
}
```

---

### GET /api/completion/history?enrollment_id=uuid
Get day-by-day calendar for an enrollment.

**Response 200**
```json
{
  "enrollment_id": "uuid",
  "start_date": "2026-03-01",
  "end_date": "2026-03-22",
  "days": [
    { "day_number": 1, "date": "2026-03-01", "status": "completed", "mode": "hard", "feeling": 4 },
    { "day_number": 2, "date": "2026-03-02", "status": "missed", "mode": null, "feeling": null }
  ]
}
```

**Status values:** `completed` | `missed` | `upcoming` | `today` | `rest_day`

---

### GET /api/completion/cohort-board?cohort_id=uuid
Get cohort leaderboard (names are privacy-masked).

**Response 200**
```json
{
  "cohort_id": "uuid",
  "cohort_name": "BodiX 21 - Tháng 3/2026",
  "date": "2026-03-07",
  "program_duration_days": 21,
  "stats": { "total_members": 15, "completed_today": 8, "avg_completion_rate": 62.5 },
  "members": [
    {
      "user_id": "uuid",
      "display_name": "Nguyen A.",
      "avatar_url": null,
      "checked_in_today": true,
      "mode_today": "hard",
      "current_streak": 5,
      "completion_rate": 80,
      "is_highlighted": false
    }
  ],
  "me_checked_in_today": true
}
```

---

## Rescue

### GET /api/rescue/status
Get current rescue/dropout status.

**Response 200**
```json
{
  "is_in_rescue": true,
  "current_intervention": { "id": "uuid", "trigger_reason": "missed_2_days", "action_taken": "send_rescue_message", "outcome": "pending" },
  "risk_score": 55,
  "risk_level": "high_risk",
  "suggested_mode": "light",
  "days_missed": 2
}
```

---

### POST /api/rescue/acknowledge
Respond to a rescue intervention.

**Body**
```json
{ "intervention_id": "uuid", "action": "return" }
```

**Action values:** `return` (commit to returning) | `pause` (pause program)

**Response 200**
```json
{ "success": true, "action": "return", "message": "Chào mừng bạn trở lại! Hành trình vẫn đang chờ." }
```

---

## Checkout

### POST /api/checkout/create
Create a pending enrollment for checkout.

**Body**
```json
{
  "slug": "bodix-21",
  "payment_method": "vnpay",
  "referral_code": "BODIX-A7K3"
}
```

**Response 201**
```json
{
  "enrollment_id": "uuid",
  "program": { "id": "uuid", "name": "BodiX 21", "price_vnd": 990000 },
  "pricing": { "original_price": 990000, "discount_amount": 99000, "final_price": 891000 },
  "referral_applied": true
}
```

---

### POST /api/checkout/confirm
Confirm payment and activate enrollment.

**Body**
```json
{ "enrollment_id": "uuid", "payment_reference": "VNP12345" }
```

**Response 200**
```json
{
  "success": true,
  "enrollment": { "id": "uuid", "status": "active", "paid_at": "...", "started_at": "2026-03-10", "cohort_id": "uuid" },
  "cohort": { "id": "uuid", "name": "...", "start_date": "2026-03-10", "end_date": "2026-03-31" },
  "program": { "id": "uuid", "name": "BodiX 21" },
  "pricing": { "original_price": 990000, "discount_amount": 0, "amount_paid": 990000 },
  "message": "Đăng ký BodiX 21 thành công! Chương trình bắt đầu ngày 2026-03-10."
}
```

---

## Reviews

### GET /api/reviews/weekly/pending
Check if a weekly review is pending (call on Sunday/Monday ICT).

**Response 200**
```json
{ "pending": true, "week_number": 3, "message": "Tuần 3 vừa kết thúc. Hãy dành 2 phút review nhé!" }
```
or `{ "pending": false, "reason": "not_review_window" }`

---

### GET /api/reviews/weekly/context
Get context for the pending weekly review form.

**Response 200**
```json
{
  "hasEnrollment": true,
  "enrollment_id": "uuid",
  "week_number": 3,
  "start_date": "2026-03-15",
  "end_date": "2026-03-21",
  "pending": true,
  "is_review_window": true,
  "week_stats": {
    "completed_count": 5, "completion_rate": 71,
    "hard_count": 3, "light_count": 2, "recovery_count": 0,
    "avg_feeling": 3.8,
    "day_completed": [true, true, false, true, true, false, true]
  }
}
```

---

### POST /api/reviews/weekly
Submit a weekly review.

**Body**
```json
{
  "enrollment_id": "uuid",
  "week_number": 3,
  "fatigue_level": 3,
  "progress_feeling": 4,
  "difficulty_rating": 3,
  "body_changes": "Bụng bớt to hơn",
  "biggest_challenge": "Dậy sớm",
  "next_week_goal": "Tập đủ 7 ngày"
}
```

**Response 200**
```json
{
  "review": { "id": "uuid", "week_number": 3, ... },
  "system_suggestion": "Tuần tới giữ nhịp này! ✅",
  "intensity_adjustment": "maintain",
  "week_stats": { "week_completion_rate": 71.4, "hard_count": 3, "avg_feeling": 3.8, ... }
}
```

---

### GET /api/reviews/weekly?enrollment_id=uuid
Get all weekly reviews for an enrollment.

**Response 200**
```json
{
  "reviews": [],
  "trend": {
    "fatigue_trend": [{ "week": 1, "value": 3 }],
    "progress_trend": [],
    "difficulty_trend": [],
    "completion_trend": []
  }
}
```

---

### GET /api/reviews/mid-program/context
Get context for mid-program reflection form.

**Response 200**
```json
{
  "eligible": true,
  "submitted": false,
  "enrollment_id": "uuid",
  "current_day": 11,
  "total_days": 21,
  "halfway_day": 11,
  "halfway_week": 2,
  "original_goal": "giam_can",
  "before_photo_url": "https://...",
  "midpoint_photo_url": null
}
```

---

### POST /api/reviews/mid-program
Submit mid-program reflection.

**Body**
```json
{
  "enrollment_id": "uuid",
  "before_photo_url": "path/to/photo",
  "midpoint_photo_url": "path/to/photo",
  "overall_progress": 7,
  "visible_changes": ["Giảm mỡ bụng", "Tăng sức bền"],
  "goal_still_relevant": true,
  "updated_goal": null,
  "wants_intensity_change": "keep_same",
  "what_works_well": "Tập sáng sớm",
  "what_to_improve": "Ngủ đủ giấc",
  "would_recommend": true,
  "recommendation_score": 9
}
```

**Response 200**
```json
{ "reflection": { "id": "uuid", ... } }
```

---

### GET /api/reviews/mid-program?enrollment_id=uuid
Get existing mid-program reflection.

**Response 200**
```json
{ "reflection": null }
```

---

## Notifications

### GET /api/notifications/preferences
Get notification preferences.

**Response 200**
```json
{
  "preferences": {
    "morning_reminder": true,
    "evening_confirmation": true,
    "rescue_messages": true,
    "preferred_channel": "zalo",
    "morning_time": "07:00",
    "evening_time": "21:00"
  }
}
```

---

### PUT /api/notifications/preferences
Update notification preferences.

**Body**
```json
{
  "morning_reminder": true,
  "evening_confirmation": false,
  "rescue_messages": true,
  "preferred_channel": "email"
}
```

**Channel values:** `email` | `zalo` | `both`

---

### GET /api/notifications/community-unread
Get count of unread community notifications.

**Response 200**
```json
{ "count": 3 }
```

---

## Community

### GET /api/community/posts?cohort_id=uuid&page=0
Get community posts for a cohort (paginated, 20 per page).

**Response 200**
```json
{
  "posts": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "display_name": "Nguyen A.",
      "post_type": "completion_share",
      "content": "Xong ngày 5 rồi!",
      "media_urls": [],
      "signed_media_urls": ["https://..."],
      "milestone_type": null,
      "likes_count": 3,
      "my_reaction": "heart",
      "is_pinned": false,
      "created_at": "..."
    }
  ],
  "has_more": false
}
```

---

### POST /api/community/posts
Create a community post.

**Body**
```json
{
  "cohort_id": "uuid",
  "post_type": "completion_share",
  "content": "Xong ngày 5!",
  "media_urls": ["path/to/image.jpg"],
  "milestone_type": null
}
```

**Post types:** `completion_share`, `milestone_share`, `progress_photo`, `motivation`, `question`, `program_complete`

---

### POST /api/community/posts/[id]/reactions
Toggle reaction on a post.

**Body**
```json
{ "reaction_type": "heart" }
```

**Reaction types:** `like`, `fire`, `clap`, `heart`

**Response 200/201**
```json
{ "action": "added", "reaction_type": "heart" }
```
or `{ "action": "removed", "reaction_type": null }`

---

### POST /api/community/reactions
(Legacy) Toggle reaction — same as above but with `post_id` in body.

**Body**
```json
{ "post_id": "uuid", "reaction_type": "fire" }
```

---

### POST /api/community/upload
Upload image for community post (multipart/form-data).

**Form fields:** `file` (File, max 5MB, JPEG/PNG/WebP), `index` (optional string index)

**Response 200**
```json
{ "path": "user_id/community/timestamp_0.jpg", "signed_url": "https://..." }
```

---

### GET /api/community/media?path=storage/path
Get signed URL redirect for a community media file.

**Response:** 302 redirect to signed URL (1-hour TTL)

---

### GET /api/community/posts/suggest
Get post suggestions based on unshared milestones and completed weeks.

**Response 200**
```json
{
  "suggestions": [
    { "type": "milestone_share", "milestone_type": "streak_7", "earned_at": "...", "prompt": "Chia sẻ thành tích: streak 7 ngày 🏆" },
    { "type": "completion_share", "week_number": 3, "prompt": "Chia sẻ tiến độ tuần 3 của bạn 💪" }
  ],
  "enrollment_id": "uuid",
  "cohort_id": "uuid"
}
```

---

### GET /api/community/posts/summary?cohort_id=uuid
Get cohort post summary stats.

**Response 200**
```json
{ "count": 47, "new_in_7d": 12 }
```

---

## Photos

### POST /api/photos/upload
Upload progress photo (multipart/form-data).

**Form fields:**
- `file` — File (JPEG/PNG/WebP, max 5MB)
- `enrollment_id` — UUID
- `photo_type` — `before` | `midpoint` | `after` | `weekly`
- `week_number` — integer (required for `weekly` and `midpoint`)
- `notes` — optional string
- `is_public` — `"true"` | `"false"`

**Response 200**
```json
{
  "photo_id": "uuid",
  "photo_url": "user_id/enrollment_id/before_1709123456.jpg",
  "signed_url": "https://...",
  "photo_type": "before",
  "uploaded_at": "..."
}
```

---

### GET /api/photos?enrollment_id=uuid
List all photos for an enrollment with signed URLs.

**Response 200**
```json
{
  "photos": [
    {
      "id": "uuid",
      "photo_type": "before",
      "photo_url": "storage/path",
      "signed_url": "https://...",
      "week_number": null,
      "notes": null,
      "is_public": false,
      "uploaded_at": "..."
    }
  ]
}
```

---

### DELETE /api/photos?photo_id=uuid
Delete a photo (removes from DB and storage).

**Response 200**
```json
{ "deleted": true, "photo_id": "uuid" }
```

---

## Referral

### GET /api/referral/code
Get or auto-create personal referral code.

**Response 200**
```json
{
  "code": "BODIX-A7K3",
  "referral_link": "https://bodix.vn/r/BODIX-A7K3",
  "stats": { "total_clicks": 12, "total_signups": 3, "total_conversions": 1 }
}
```

---

### POST /api/referral/code
Create custom referral code.

**Body**
```json
{ "code": "MINHBODIX" }
```

**Code rules:** 3–20 chars, uppercase letters/digits/hyphens/underscores, no spaces.

---

### GET /api/referral/validate?code=BODIX-A7K3
Validate a referral code (auth optional).

**Response 200**
```json
{
  "valid": true,
  "code": "BODIX-A7K3",
  "code_type": "referral",
  "referrer_name": "Minh",
  "reward_description": "Giảm 10% chương trình đầu tiên",
  "referee_reward_type": "discount_percent",
  "referee_reward_value": 10
}
```
or `{ "valid": false, "reason": "code_expired" }`

---

### POST /api/referral/track
Track referral events (click/signup/conversion).

**Body**
```json
{
  "code": "BODIX-A7K3",
  "event": "click",
  "metadata": { "source": "zalo_share" }
}
```

**Events:** `click` | `signup` | `conversion`

For `conversion`:
```json
{
  "code": "BODIX-A7K3",
  "event": "conversion",
  "metadata": {
    "tracking_id": "uuid",
    "program_id": "uuid",
    "enrollment_id": "uuid",
    "conversion_amount": 990000
  }
}
```

---

### GET /api/referral/tracking
Get referral tracking records for current user's codes.

---

### POST /api/referral/anti-fraud
Internal anti-fraud check (requires `INTERNAL_API_SECRET` header).

---

## Affiliate

### POST /api/affiliate/apply
Apply to become an affiliate.

**Eligibility:** Completed ≥1 BodiX program OR ≥1000 social followers.

**Body**
```json
{
  "social_channels": [{ "platform": "instagram", "url": "https://...", "followers": 5000 }],
  "motivation": "Tôi muốn chia sẻ hành trình của mình",
  "bank_name": "Vietcombank",
  "bank_account_number": "1234567890",
  "bank_account_name": "NGUYEN VAN A"
}
```

**Response 201**
```json
{ "status": "pending_review", "message": "...", "affiliate_profile_id": "uuid" }
```

---

### GET /api/affiliate/status
Get affiliate application status.

---

### GET /api/affiliate/profile
Get affiliate profile details.

---

### GET /api/affiliate/dashboard
Get full affiliate dashboard data.

**Response 200**
```json
{
  "profile": { "tier": "basic", "is_approved": true, "commission_rate": 15, "full_name": "..." },
  "code": { "code": "MINHBODIX", "link": "https://bodix.vn/p/MINHBODIX" },
  "stats": {
    "total_clicks": 120, "total_signups": 20, "total_conversions": 8,
    "total_revenue": 7920000, "total_earned": 1188000,
    "pending_balance": 500000, "paid_total": 688000,
    "this_month_revenue": 1980000, "this_month_commission": 297000
  },
  "recent_conversions": [],
  "monthly_chart": [],
  "bank_info": { "bank_name": "...", "bank_account_number": "...", "bank_account_name": "..." },
  "withdrawal_history": []
}
```

---

### POST /api/affiliate/withdraw
Request a cash withdrawal. Minimum: 200,000 VND.

**Body**
```json
{ "amount": 500000 }
```

**Response 200**
```json
{
  "withdrawal_id": "uuid",
  "status": "processing",
  "amount": 500000,
  "balance_after": 0,
  "message": "...",
  "bank_info": { "bank_name": "...", "account_number": "...", "account_name": "..." }
}
```

---

## Admin Routes (require admin role)

### GET /api/admin/analytics/overview
Full analytics overview (cached 5 min).

### GET /api/admin/analytics/cohorts
Cohort list with stats.

### GET /api/admin/analytics/cohorts/[id]
Single cohort detail.

### GET /api/admin/analytics/dropout
Dropout analysis data.

### GET /api/admin/analytics/revenue
Revenue breakdown.

### GET /api/admin/analytics/funnel
Conversion funnel stats.

### GET /api/admin/users
User list with filters.

### GET /api/admin/users/[id]
Single user detail.

### GET /api/admin/nudging/overview
Nudging system overview.

### POST /api/admin/nudging/manual-intervention
Trigger manual rescue intervention.

### GET /api/admin/nudging/nudge-logs
Nudge delivery logs.

### GET /api/admin/nudging/rescue-history
Rescue intervention history.

### GET /api/admin/nudging/risk-monitor
Real-time risk score monitor.

### GET /api/admin/referral/overview
Referral program overview.

### GET /api/admin/referral/codes
All referral codes.

### GET /api/admin/referral/conversions
Referral conversion list.

### GET /api/admin/affiliate
Affiliate applications list.

### POST /api/admin/affiliate/update
Approve/update affiliate status.

### GET /api/admin/affiliate/withdrawals
Pending withdrawal requests.

### POST /api/admin/affiliate/payouts
Process affiliate payouts.

---

## Webhooks

### POST /api/webhooks/payment
Payment gateway webhook (VNPay/Stripe). Internal use only.

---

## Error Format

All errors return:
```json
{ "error": "Human-readable error message in Vietnamese" }
```

Common HTTP codes:
- `400` — Bad request / validation error
- `401` — Not authenticated
- `403` — Not authorized / not enrolled
- `404` — Resource not found
- `409` — Conflict (already exists)
- `410` — Gone (expired)
- `422` — Unprocessable entity
- `429` — Rate limit exceeded (`Retry-After` header set)
- `500` — Server error
