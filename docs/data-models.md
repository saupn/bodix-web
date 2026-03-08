# BodiX Data Models

All tables are in the `public` schema. All IDs are UUIDs. Timestamps are `timestamptz` (ISO 8601 with timezone).

---

## profiles

Extends Supabase `auth.users`. Created automatically on sign-up via trigger.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | = auth.users.id |
| full_name | text | Set during onboarding |
| phone | text | Vietnamese format (+84...) |
| phone_verified | boolean | |
| date_of_birth | date | |
| gender | text | `male` \| `female` \| `other` |
| fitness_goal | text[] | `giam_can`, `tang_co`, `tang_suc_ben`, `cai_thien_suc_khoe`, `giam_stress` |
| trial_started_at | timestamptz | |
| trial_ends_at | timestamptz | trial_started_at + 3 days |
| role | text | `user` \| `admin` (default `user`) |
| created_at | timestamptz | |
| updated_at | timestamptz | |

```dart
class Profile {
  final String id;
  final String? fullName;
  final String? phone;
  final bool phoneVerified;
  final String? dateOfBirth; // YYYY-MM-DD
  final String? gender; // 'male' | 'female' | 'other'
  final List<String> fitnessGoal;
  final DateTime? trialStartedAt;
  final DateTime? trialEndsAt;
  final String role; // 'user' | 'admin'
  final DateTime createdAt;
}
```

---

## programs

The 3 BodiX programs seeded at setup.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| slug | text UNIQUE | `bodix-21`, `bodix-6w`, `bodix-12w` |
| name | text | `BodiX 21`, `BodiX 6W`, `BodiX 12W` |
| description | text | |
| duration_days | integer | 21, 42, 84 |
| price_vnd | integer | 990000, 1990000, 3490000 |
| price_usd | numeric | |
| is_active | boolean | |
| sort_order | integer | |
| features | jsonb | `string[]` — list of feature bullets |
| created_at | timestamptz | |

```dart
class Program {
  final String id;
  final String slug;
  final String name;
  final String? description;
  final int durationDays;
  final int priceVnd;
  final double? priceUsd;
  final bool isActive;
  final List<String> features;
}
```

---

## cohorts

A cohort is a batch of users starting a program together.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| program_id | uuid FK → programs | |
| name | text | e.g. "BodiX 21 - Tháng 3/2026" |
| start_date | date | |
| end_date | date | |
| max_members | integer | default 50 |
| current_members | integer | |
| status | text | `upcoming` \| `active` \| `completed` |
| created_at | timestamptz | |

```dart
class Cohort {
  final String id;
  final String programId;
  final String name;
  final String startDate; // YYYY-MM-DD
  final String endDate;   // YYYY-MM-DD
  final int maxMembers;
  final int currentMembers;
  final String status; // 'upcoming' | 'active' | 'completed'
}
```

---

## enrollments

A user's participation in a program.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → profiles | |
| program_id | uuid FK → programs | |
| cohort_id | uuid FK → cohorts | null until payment confirmed |
| status | text | `trial` \| `pending_payment` \| `active` \| `paused` \| `completed` \| `dropped` |
| enrolled_at | timestamptz | |
| paid_at | timestamptz | |
| started_at | timestamptz | cohort start date |
| completed_at | timestamptz | |
| current_day | integer | default 0 (tracks progress) |
| payment_method | text | `vnpay`, `stripe`, `manual` |
| payment_reference | text | gateway reference |
| amount_paid | integer | VND after discounts |
| referral_code_id | uuid FK → referral_codes | |
| referral_discount_amount | integer | VND discount applied |
| created_at | timestamptz | |
| updated_at | timestamptz | |

```dart
class Enrollment {
  final String id;
  final String userId;
  final String programId;
  final String? cohortId;
  final String status;
  final DateTime enrolledAt;
  final DateTime? paidAt;
  final DateTime? startedAt;
  final DateTime? completedAt;
  final int currentDay;
  final String? paymentMethod;
  final int? amountPaid;
  final String? referralCodeId;
  final int? referralDiscountAmount;
}
```

---

## workout_templates

Daily workout plans for each program.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| program_id | uuid FK → programs | |
| day_number | integer | 1-21 / 1-42 / 1-84 |
| week_number | integer | |
| day_of_week | integer | 1=Mon, 7=Sun |
| workout_type | text | `main` \| `recovery` \| `flexible` |
| title | text | e.g. "Ngày 1: Lower Body Basics" |
| description | text | |
| duration_minutes | integer | |
| hard_version | jsonb | `{ video_url, exercises: [] }` |
| light_version | jsonb | |
| recovery_version | jsonb | |
| sort_order | integer | |

```dart
class WorkoutTemplate {
  final String id;
  final String programId;
  final int dayNumber;
  final int weekNumber;
  final int dayOfWeek;
  final String workoutType; // 'main' | 'recovery' | 'flexible'
  final String title;
  final String? description;
  final int durationMinutes;
  final Map<String, dynamic>? hardVersion;
  final Map<String, dynamic>? lightVersion;
  final Map<String, dynamic>? recoveryVersion;
}
```

---

## daily_checkins

One record per enrollment per day. Unique constraint on `(enrollment_id, day_number)`.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| enrollment_id | uuid FK → enrollments | |
| user_id | uuid FK → profiles | |
| cohort_id | uuid FK → cohorts | |
| day_number | integer | 1-84 |
| workout_date | date | YYYY-MM-DD |
| mode | text | `hard` \| `light` \| `recovery` \| `skip` |
| feeling | integer | 1–5 (1=Rất mệt, 5=Tuyệt vời) |
| feeling_note | text | optional |
| duration_minutes | integer | actual workout duration |
| completed_at | timestamptz | |

```dart
class DailyCheckin {
  final String id;
  final String enrollmentId;
  final String userId;
  final String? cohortId;
  final int dayNumber;
  final String workoutDate; // YYYY-MM-DD
  final String mode; // 'hard' | 'light' | 'recovery' | 'skip'
  final int? feeling;
  final String? feelingNote;
  final int? durationMinutes;
  final DateTime completedAt;
}
```

---

## streaks

One record per enrollment (upserted by checkin API).

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| enrollment_id | uuid UNIQUE FK → enrollments | |
| user_id | uuid FK → profiles | |
| current_streak | integer | consecutive days |
| longest_streak | integer | all-time best |
| total_completed_days | integer | |
| total_hard_days | integer | |
| total_light_days | integer | |
| total_recovery_days | integer | |
| total_skip_days | integer | |
| last_checkin_date | date | |
| streak_started_at | date | |
| updated_at | timestamptz | |

```dart
class Streak {
  final String enrollmentId;
  final int currentStreak;
  final int longestStreak;
  final int totalCompletedDays;
  final int totalHardDays;
  final int totalLightDays;
  final int totalRecoveryDays;
  final int totalSkipDays;
  final String? lastCheckinDate; // YYYY-MM-DD
  final String? streakStartedAt; // YYYY-MM-DD
}
```

---

## completion_milestones

Achievement badges. Unique per `(enrollment_id, milestone_type)`.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| enrollment_id | uuid FK → enrollments | |
| user_id | uuid FK → profiles | |
| milestone_type | text | see below |
| achieved_at | timestamptz | |
| metadata | jsonb | e.g. `{ week: 3 }` |

**Milestone types:** `streak_3`, `streak_7`, `streak_14`, `streak_21`, `week_complete`, `halfway`, `final_week`, `program_complete`, `all_hard`, `first_checkin`, `comeback`

```dart
class CompletionMilestone {
  final String enrollmentId;
  final String milestoneType;
  final DateTime achievedAt;
  final Map<String, dynamic> metadata;
}
```

---

## dropout_signals

Risk signals — not visible to users, admin/system only.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| enrollment_id | uuid FK → enrollments | |
| user_id | uuid FK → profiles | |
| signal_type | text | `missed_1_day`, `missed_2_days`, `missed_3_plus_days`, `downgrade_pattern`, `low_feeling_trend`, `skip_pattern`, `d3_risk`, `d7_risk`, `d14_risk` |
| risk_score | integer | 0–100 |
| signal_date | date | |
| details | jsonb | |
| resolved | boolean | |
| resolved_at | timestamptz | |
| resolved_by | text | `system`, `coach`, `user_returned` |

---

## rescue_interventions

Rescue actions triggered by dropout scanner.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| enrollment_id | uuid FK → enrollments | |
| user_id | uuid FK → profiles | |
| trigger_reason | text | |
| risk_score_at_trigger | integer | |
| action_taken | text | `switch_to_light`, `send_rescue_message`, `pause_program` |
| message_sent | text | |
| outcome | text | `pending` \| `user_returned` \| `user_paused` \| `no_response` |
| outcome_at | timestamptz | |
| created_at | timestamptz | |

```dart
class RescueIntervention {
  final String id;
  final String enrollmentId;
  final String userId;
  final String triggerReason;
  final int riskScoreAtTrigger;
  final String actionTaken;
  final String? messageSent;
  final String outcome; // 'pending' | 'user_returned' | 'user_paused' | 'no_response'
  final DateTime? outcomeAt;
  final DateTime createdAt;
}
```

---

## notifications

In-app and external notification records.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → profiles | |
| type | text | `trial_expired`, `payment_confirmed`, `referral_conversion`, `rescue_soft`, `rescue_urgent`, `rescue_critical`, `community_post`, etc. |
| channel | text | `email` \| `zalo` \| `push` \| `in_app` |
| title | text | |
| content | text | |
| metadata | jsonb | `{ action_url, enrollment_id, ... }` |
| is_read | boolean | |
| sent_at | timestamptz | |
| read_at | timestamptz | |
| created_at | timestamptz | |

```dart
class AppNotification {
  final String id;
  final String userId;
  final String type;
  final String channel;
  final String? title;
  final String? content;
  final Map<String, dynamic> metadata;
  final bool isRead;
  final DateTime? sentAt;
  final DateTime createdAt;
}
```

---

## notification_preferences

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid UNIQUE FK → profiles | |
| morning_reminder | boolean | default true |
| evening_confirmation | boolean | default true |
| rescue_messages | boolean | default true |
| preferred_channel | text | `email` \| `zalo` \| `both` |
| morning_time | text | `07:00` |
| evening_time | text | `21:00` |
| updated_at | timestamptz | |

---

## nudge_logs

Log of all automated nudge sends.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → profiles | |
| enrollment_id | uuid FK → enrollments | |
| nudge_type | text | `morning_reminder`, `evening_confirmation`, `rescue_soft`, `rescue_urgent`, `rescue_critical` |
| channel | text | `email` \| `zalo` |
| content_template | text | variant ID e.g. `mr_1` |
| content_variables | jsonb | template vars used |
| delivered | boolean | send success |
| led_to_checkin | boolean | was effective |
| sent_at | timestamptz | |

---

## weekly_reviews

Unique per `(enrollment_id, week_number)`.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| enrollment_id | uuid FK → enrollments | |
| user_id | uuid FK → profiles | |
| week_number | integer | 1-12 |
| fatigue_level | integer | 1–5 |
| progress_feeling | integer | 1–5 |
| difficulty_rating | integer | 1–5 |
| body_changes | text | optional |
| biggest_challenge | text | optional |
| next_week_goal | text | optional |
| week_completion_rate | numeric | auto-calculated |
| week_hard_count | integer | |
| week_light_count | integer | |
| week_recovery_count | integer | |
| week_skip_count | integer | |
| avg_feeling | numeric | |
| system_suggestion | text | AI-generated suggestion |
| intensity_adjustment | text | `increase` \| `maintain` \| `decrease` |
| submitted_at | timestamptz | |

```dart
class WeeklyReview {
  final String id;
  final String enrollmentId;
  final int weekNumber;
  final int fatigueLevel;
  final int progressFeeling;
  final int difficultyRating;
  final String? bodyChanges;
  final String? biggestChallenge;
  final String? nextWeekGoal;
  final double? weekCompletionRate;
  final int weekHardCount;
  final int weekLightCount;
  final int weekRecoveryCount;
  final int weekSkipCount;
  final double? avgFeeling;
  final String? systemSuggestion;
  final String? intensityAdjustment;
  final DateTime submittedAt;
}
```

---

## mid_program_reflections

One per enrollment (unique constraint).

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| enrollment_id | uuid UNIQUE FK → enrollments | |
| user_id | uuid FK → profiles | |
| before_photo_url | text | storage path |
| midpoint_photo_url | text | storage path |
| overall_progress | integer | 1–10 |
| visible_changes | text[] | array of change descriptions |
| original_goal | text | |
| goal_still_relevant | boolean | |
| updated_goal | text | |
| wants_intensity_change | text | `more_hard` \| `keep_same` \| `more_light` |
| what_works_well | text | |
| what_to_improve | text | |
| would_recommend | boolean | |
| recommendation_score | integer | 0–10 (NPS) |
| submitted_at | timestamptz | |

---

## progress_photos

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| enrollment_id | uuid FK → enrollments | |
| user_id | uuid FK → profiles | |
| photo_type | text | `before` \| `midpoint` \| `after` \| `weekly` |
| photo_url | text | Supabase Storage path in `progress-photos` bucket |
| week_number | integer | for weekly/midpoint |
| notes | text | |
| is_public | boolean | |
| uploaded_at | timestamptz | |

**Storage bucket:** `progress-photos` (private, authenticated users only)
**Path format:** `{user_id}/{enrollment_id}/{photo_type}[_w{week}]_{timestamp}.{ext}`

```dart
class ProgressPhoto {
  final String id;
  final String enrollmentId;
  final String photoType; // 'before' | 'midpoint' | 'after' | 'weekly'
  final String photoUrl; // storage path
  final String? signedUrl; // generated on demand, 1hr TTL
  final int? weekNumber;
  final String? notes;
  final bool isPublic;
  final DateTime uploadedAt;
}
```

---

## community_posts

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → profiles | |
| cohort_id | uuid FK → cohorts | |
| post_type | text | `completion_share`, `milestone_share`, `progress_photo`, `motivation`, `question`, `program_complete` |
| content | text | |
| media_urls | text[] | storage paths |
| milestone_type | text | if post_type = `milestone_share` |
| likes_count | integer | denormalized, auto-synced |
| is_pinned | boolean | |
| is_hidden | boolean | admin moderation |
| created_at | timestamptz | |

```dart
class CommunityPost {
  final String id;
  final String userId;
  final String? cohortId;
  final String postType;
  final String? content;
  final List<String> mediaUrls;
  final String? milestoneType;
  final int likesCount;
  final bool isPinned;
  final DateTime createdAt;
  // Derived on fetch:
  final String? displayName;
  final List<String>? signedMediaUrls;
  final String? myReaction;
}
```

---

## community_reactions

One per user per post (unique constraint).

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| post_id | uuid FK → community_posts | |
| user_id | uuid FK → profiles | |
| reaction_type | text | `like` \| `fire` \| `clap` \| `heart` |
| created_at | timestamptz | |

---

## referral_codes

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → profiles | |
| code | text UNIQUE | e.g. `BODIX-A7K3`, `MINHBODIX` |
| code_type | text | `referral` \| `affiliate` |
| reward_type | text | `credit`, `discount_percent`, `discount_fixed`, `free_days` |
| reward_value | integer | |
| referee_reward_type | text | what the referred person gets |
| referee_reward_value | integer | |
| commission_rate | numeric | % for affiliate codes |
| total_clicks | integer | |
| total_signups | integer | |
| total_conversions | integer | |
| total_revenue_generated | integer | VND |
| is_active | boolean | |
| max_uses | integer | null = unlimited |
| expires_at | timestamptz | |

---

## referral_tracking

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| referral_code_id | uuid FK → referral_codes | |
| referrer_id | uuid FK → profiles | |
| referred_id | uuid FK → profiles | null until signup |
| status | text | `clicked` → `signed_up` → `trial_started` → `converted` → `completed` |
| program_id | uuid | on conversion |
| enrollment_id | uuid | on conversion |
| conversion_amount | integer | VND |
| referral_ip | text | |
| referral_source | text | `zalo_share`, `facebook_share`, `copy_link`, `qr_code` |
| clicked_at | timestamptz | |
| signed_up_at | timestamptz | |
| converted_at | timestamptz | |

---

## affiliate_profiles

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid UNIQUE FK → profiles | |
| affiliate_tier | text | `basic` \| `silver` \| `gold` \| `platinum` |
| social_channels | jsonb | `[{ platform, url, followers }]` |
| bank_name | text | |
| bank_account_number | text | |
| bank_account_name | text | |
| total_earned | integer | VND |
| total_paid | integer | VND |
| pending_balance | integer | VND |
| is_approved | boolean | |
| approved_at | timestamptz | |

**Commission rates by tier:**
- basic: 15%
- silver: 18%
- gold: 20%
- platinum: 25%

---

## user_credits

Credit wallet ledger.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → profiles | |
| amount | integer | VND (positive=credit, negative=debit) |
| balance_after | integer | balance after this transaction |
| transaction_type | text | `referral_reward`, `affiliate_commission`, `purchase_discount`, `withdrawal`, `admin_adjustment` |
| reference_id | uuid | related record ID |
| description | text | |
| withdrawal_status | text | `pending`, `paid` (for withdrawals) |
| created_at | timestamptz | |

---

## trial_activities

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → profiles | |
| program_id | uuid FK → programs | |
| activity_type | text | `view_program`, `view_workout`, `try_workout`, `complete_trial_day` |
| metadata | jsonb | e.g. `{ day_number: 1 }` |
| created_at | timestamptz | |

---

## Materialized Views (admin only)

These views are pre-computed for analytics. Not accessible via anon/authenticated roles — admin accesses via service_role.

| View | Refreshed | Description |
|---|---|---|
| `mv_program_stats` | Periodic | Enrollment counts and completion rates per program |
| `mv_cohort_stats` | Periodic | Active/completed members per cohort |
| `mv_upgrade_funnel` | Periodic | trial→paid conversion funnel |
| `mv_revenue_summary` | Periodic | Revenue by program/month |
| `mv_monthly_revenue_6m` | Periodic | Last 6 months revenue |
