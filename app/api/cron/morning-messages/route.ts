import {
  addCalendarDays,
  calendarDaysBetween,
  getVietnamDateString,
  getVietnamWeekday,
  isoTimestampToVietnamYmd,
} from '@/lib/date/vietnam';
import {
  loadExerciseTranslations,
  translateExerciseName,
  type ExerciseTranslationMap,
} from '@/lib/exercises/translate';
import { sendFcmMessage } from '@/lib/messaging/adapters/push';
import { sendViaZalo } from '@/lib/messaging/adapters/zalo';
import { insertSupportSystemMessage } from '@/lib/messaging/chat-mirror';
import {
  getEligibleForNudge,
  type EligibleEnrollment,
} from '@/lib/notifications/eligible-enrollments';
import {
  buildRescueMessage,
  countMissedWorkoutDays,
  rescueAwaitingUntil,
  rescueLevel,
  WELCOME_BACK_LINE,
  type RescueLevel,
  type RescueWorkoutContext,
} from '@/lib/rescue/escalation';
import { createServiceClient } from '@/lib/supabase/service';
import { getTrialMorningAnchorDate, TRIAL_DAYS } from '@/lib/trial/utils';
import { generateWorkoutToken } from '@/lib/workout-token';
import { NextRequest, NextResponse } from 'next/server';

const APP_URL = 'https://bodix.fit';

/**
 * Magic link phiên tập: sinh token gắn user → bodix.fit/w/[token] → bấm vào
 * tự nhận diện, vào thẳng phiên tập hôm nay (KHÔNG cần đăng nhập).
 * Nếu sinh token lỗi → fallback link trần (vẫn mở được nhưng phải login).
 */
async function buildWorkoutLink(
  userId: string,
  enrollmentId: string | null | undefined,
  fallbackPath: string,
): Promise<string> {
  try {
    const token = await generateWorkoutToken(userId, enrollmentId ?? null);
    return `${APP_URL}/w/${token}`;
  } catch (err) {
    console.error('[morning-messages] token gen failed, fallback link:', userId, err);
    return `${APP_URL}${fallbackPath}`;
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Exercises — SOURCE OF TRUTH: workout_templates.exercises.items[].name
// (KHÔNG hardcode tên bài. Tin nhắn đọc đúng cùng nguồn với trang phiên tập.)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface ExerciseItem {
  name: string;
}

interface WorkoutExercises {
  items?: ExerciseItem[];
}

// Lấy danh sách tên bài từ exercises.items của workout_templates.
function getExerciseNames(exercises: WorkoutExercises | null): string[] {
  return (exercises?.items ?? [])
    .map((it) => it?.name)
    .filter((n): n is string => !!n);
}

// Program config — extensible for 6W/12W
const PROGRAM_CONFIG: Record<string, { slug: string; totalDays: number }> = {
  'bodix-21': { slug: 'bodix-21', totalDays: 21 },
  // 'bodix-6w': { slug: 'bodix-6w', totalDays: 42 },
  // 'bodix-12w': { slug: 'bodix-12w', totalDays: 84 },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BUILD MESSAGES — active program
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildMainMessage(
  name: string,
  dayNumber: number,
  totalDays: number,
  exerciseNames: string[],
  sessionTitle: string,
  isWeekStart: boolean,
  translationMap: ExerciseTranslationMap,
  workoutUrl: string,
): string {
  const exerciseList = exerciseNames
    .map(ex => `- ${translateExerciseName(ex, translationMap)}`)
    .join('\n');
  const weekStartTip = isWeekStart
    ? '\n\n💡 Tuần này có thắc mắc gì – nhắn mình bất cứ lúc nào nha!'
    : '';

  return (
    `Hi ${name}! 🌸 Ngày ${dayNumber}/${totalDays} – hôm nay mình cùng nhau tập ${sessionTitle}. Các bài tập gồm:\n` +
    `${exerciseList}\n` +
    `\n` +
    `▶️ Xem video: ${workoutUrl}\n` +
    `\n` +
    `Tập xong nhắn qua đây:\n` +
    `  3 → đủ 3 lượt (~21 phút)\n` +
    `  2 → 2 lượt (~14 phút)\n` +
    `  1 → 1 lượt (~7 phút)\n` +
    `\n` +
    `Cả 3 đều tính hoàn thành nha! 💪` +
    weekStartTip
  );
}

function buildRecoveryMessage(
  name: string,
  dayNumber: number,
  totalDays: number,
  isWeekStart: boolean,
  workoutUrl: string,
): string {
  const weekStartTip = isWeekStart
    ? '\n\n💡 Tuần này có thắc mắc gì – nhắn mình bất cứ lúc nào nha!'
    : '';

  return (
    `Hi ${name}! 🧘 Ngày ${dayNumber}/${totalDays} – hôm nay nhẹ nhàng thôi nha.\n` +
    `\n` +
    `Recovery giúp cơ thể phục hồi. 1 lượt (~7 phút).\n` +
    `\n` +
    `▶️ Xem video: ${workoutUrl}\n` +
    `\n` +
    `Xong rồi nhắn 1 nha!` +
    weekStartTip
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BUILD MESSAGE — Chủ nhật: tin Review (active, KHÔNG tập)
// Không số đo cơ thể, không so sánh cá nhân, giọng ghi nhận.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Dòng ghi nhận theo số buổi X/6 (không phán xét).
function reviewRecognitionLine(x: number): string {
  if (x >= 6) return 'Một tuần trọn vẹn – bạn đã giữ đúng cam kết với chính mình!';
  if (x >= 4) return 'Một tuần rất đều – hoàn thành quan trọng hơn hoàn hảo, và bạn đang làm đúng điều đó.';
  if (x >= 1) return 'Tuần này có vài buổi lỡ nhịp, không sao cả. Điều quan trọng là bạn vẫn ở đây. Tuần mới mình đi tiếp nhé.';
  return 'Tuần này bận rộn phải không? Không sao – thứ 2 là một khởi đầu mới. Chỉ cần 1 buổi Easy để quay lại nhịp.';
}

function buildReviewMessage(
  name: string,
  cohortName: string,
  personalCount: number,
  cohortCount: number,
  qaContent: string | null,
  videoUrl: string | null,
): string {
  const qaBlock = qaContent ? `\n💡 Giải đáp tuần này: ${qaContent}\n` : '';
  const videoBlock = videoUrl ? `\n🎬 Xem video Nhìn lại tuần: ${videoUrl}\n` : '';

  return (
    `🪞 Chủ nhật – ngày Nhìn lại của BodiX\n` +
    `\n` +
    `Chào ${name}! Hôm nay không có buổi tập. Mình cùng nhìn lại tuần vừa qua nhé.\n` +
    `\n` +
    `📊 Tuần của bạn:\n` +
    `Bạn đã hoàn thành ${personalCount}/6 buổi.\n` +
    `${reviewRecognitionLine(personalCount)}\n` +
    `\n` +
    `👥 Cả ${cohortName}:\n` +
    `Tuần này cả đợt hoàn thành ${cohortCount} buổi tập. Bạn không đi một mình!\n` +
    qaBlock +
    videoBlock +
    `\n` +
    `Tuần này bạn thấy cơ thể thế nào? Trả lời bằng 1 con số:\n` +
    `  1 → rất mệt\n` +
    `  2 → hơi mệt\n` +
    `  3 → bình thường\n` +
    `  4 → khá khỏe\n` +
    `  5 → rất khỏe\n` +
    `\n` +
    `Thứ 2 mình bắt đầu tuần mới. Hôm nay nghỉ ngơi thật tốt nhé! 🌿`
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BUILD MESSAGES — trial (D1–D3, thân mật)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildTrialMainMessage(
  name: string,
  trialDay: number,
  exerciseNames: string[],
  sessionTitle: string,
  isWeekStart: boolean,
  translationMap: ExerciseTranslationMap,
  workoutUrl: string,
): string {
  const exerciseList = exerciseNames
    .map(ex => `- ${translateExerciseName(ex, translationMap)}`)
    .join('\n');
  const weekTip = isWeekStart
    ? '\n\n💬 Có gì thắc mắc cứ nhắn mình nha – đang tập thử mà, thoải mái đi!'
    : '';

  return (
    `Chào ${name} ơi! 🌿 Ngày ${trialDay}/${TRIAL_DAYS} tập thử – hôm nay mình cùng nhau tập ${sessionTitle}. Các bài tập gồm:\n` +
    `${exerciseList}\n` +
    `\n` +
    `▶️ Xem bài: ${workoutUrl}\n` +
    `\n` +
    `Tập xong nhắn qua đây:\n` +
    `  3 → đủ 3 lượt (~21 phút)\n` +
    `  2 → 2 lượt (~14 phút)\n` +
    `  1 → 1 lượt (~7 phút)\n` +
    `\n` +
    `Cả 3 đều tính hoàn thành – cứ từ từ, quan trọng là bạn không bỏ cuộc! 💪` +
    weekTip
  );
}

function buildTrialRecoveryMessage(
  name: string,
  trialDay: number,
  isWeekStart: boolean,
  workoutUrl: string,
): string {
  const weekTip = isWeekStart
    ? '\n\n💬 Có gì thắc mắc cứ nhắn mình nha!'
    : '';

  return (
    `Chào ${name}! 🧘 Ngày ${trialDay}/${TRIAL_DAYS} tập thử – hôm nay cho cơ thể phục hồi nhẹ nhàng thôi nha.\n` +
    `\n` +
    `Recovery ~7 phút một lượt.\n` +
    `\n` +
    `▶️ Xem bài: ${workoutUrl}\n` +
    `\n` +
    `Xong nhắn 1 là được!` +
    weekTip
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ROUTE HANDLER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function handleMorningMessages(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const config = PROGRAM_CONFIG['bodix-21'];

  // Lấy program
  const { data: program } = await supabase
    .from('programs')
    .select('id')
    .eq('slug', config.slug)
    .single();

  if (!program) {
    return NextResponse.json({ sent: 0, skipped: 0, errors: 0, message: 'Program bodix-21 not found' });
  }

  const todayVN = getVietnamDateString();
  const yesterdayVN = addCalendarDays(todayVN, -1);
  const todayVNStartUtc = new Date(`${todayVN}T00:00:00+07:00`).toISOString();
  let sentCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  // Rescue counters (adaptive morning message)
  const rescueStats = { l1: 0, l2: 0, l3: 0, dormant: 0, welcome_back: 0 };
  const skipReasons: string[] = [];
  const errorReasons: string[] = [];
  // In-memory dedup: mỗi user chỉ nhận đúng 1 tin trong 1 lần chạy cron,
  // kể cả khi rơi vào cả trial loop và active loop hoặc có duplicate rows từ query
  const sentUserIds = new Set<string>();

  function skip(userId: string, reason: string) {
    console.log('[morning-messages] SKIP user:', userId, 'reason:', reason);
    skipReasons.push(`${userId}: ${reason}`);
    skippedCount++;
  }

  function fail(userId: string, reason: string) {
    console.error('[morning-messages] ERROR user:', userId, 'reason:', reason);
    errorReasons.push(`${userId}: ${reason}`);
    errorCount++;
  }

  // Dedup: trả true nếu user đã nhận morning_reminder hôm nay (tính theo giờ VN)
  async function alreadySentToday(userId: string): Promise<boolean> {
    const { data } = await supabase
      .from('nudge_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('nudge_type', 'morning_reminder')
      .gte('created_at', todayVNStartUtc)
      .limit(1)
      .maybeSingle();
    return !!data;
  }

  // Dedup riêng cho tin Review CN (nudge_type='week_review').
  async function alreadySentReviewToday(userId: string): Promise<boolean> {
    const { data } = await supabase
      .from('nudge_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('nudge_type', 'week_review')
      .gte('created_at', todayVNStartUtc)
      .limit(1)
      .maybeSingle();
    return !!data;
  }

  // Dedup cho tin Rescue (nudge_type rescue_soft/urgent/critical) trong hôm nay.
  async function alreadySentRescueToday(userId: string): Promise<boolean> {
    const { data } = await supabase
      .from('nudge_logs')
      .select('id')
      .eq('user_id', userId)
      .in('nudge_type', ['rescue_soft', 'rescue_urgent', 'rescue_critical'])
      .gte('created_at', todayVNStartUtc)
      .limit(1)
      .maybeSingle();
    return !!data;
  }

  // ── Chủ nhật (theo lịch VN) → active user nhận tin Review thay tin tập. ──
  // Cohort luôn khai giảng thứ 2 nên CN thực trùng day 7/14/21 (review), nhưng
  // ta xác định CN theo NGÀY LỊCH, không dựa workout_type.
  const isSundayVN = getVietnamWeekday(todayVN) === 0;
  const weekMonVN = addCalendarDays(todayVN, -6); // Thứ 2 tuần vừa qua
  const weekSatVN = addCalendarDays(todayVN, -1); // Thứ 7 tuần vừa qua

  // Cache số buổi cả đợt trong tuần theo cohort_id (tính 1 lần / cohort).
  const cohortWeekCount = new Map<string, number>();
  // Cache Q&A + video theo cohort_id (week_start_date = weekMonVN cố định trong 1 lần chạy).
  const reviewContentCache = new Map<
    string,
    { qa: string | null; video: string | null }
  >();

  async function getCohortWeekCount(cohortId: string): Promise<number> {
    if (cohortWeekCount.has(cohortId)) return cohortWeekCount.get(cohortId)!;
    const { count } = await supabase
      .from('daily_checkins')
      .select('id', { count: 'exact', head: true })
      .eq('cohort_id', cohortId)
      .gte('workout_date', weekMonVN)
      .lte('workout_date', weekSatVN);
    const n = count ?? 0;
    cohortWeekCount.set(cohortId, n);
    return n;
  }

  // Q&A + video admin nhập ở weekly_review_content (cohort_id + week_start_date=thứ 2 tuần vừa qua).
  // Không có row / bảng chưa tạo → trả null → tin Review vẫn hoàn chỉnh (bỏ 2 khối optional).
  async function getReviewContent(
    cohortId: string | null,
  ): Promise<{ qa: string | null; video: string | null }> {
    if (!cohortId) return { qa: null, video: null };
    if (reviewContentCache.has(cohortId)) return reviewContentCache.get(cohortId)!;
    let content = { qa: null as string | null, video: null as string | null };
    const { data, error } = await supabase
      .from('weekly_review_content')
      .select('qa_content, video_url')
      .eq('cohort_id', cohortId)
      .eq('week_start_date', weekMonVN)
      .maybeSingle();
    if (error) {
      console.warn('[morning-messages] weekly_review_content lookup failed:', error.message);
    } else {
      content = { qa: data?.qa_content ?? null, video: data?.video_url ?? null };
    }
    reviewContentCache.set(cohortId, content);
    return content;
  }

  // Load translation map MỘT lần đầu cron (~29 rows) — tránh N+1 query
  const translationMap = await loadExerciseTranslations(supabase);

  // ── Lấy eligible enrollments (chung helper với evening) ──
  const { enrollments: eligible, breakdown } = await getEligibleForNudge(
    'morning',
    todayVN,
    program.id,
  );

  // Dedup theo user_id (nếu user có nhiều enrollment, chỉ xử lý 1)
  const byUser = new Map<string, EligibleEnrollment>();
  for (const en of eligible) {
    if (!byUser.has(en.user_id)) byUser.set(en.user_id, en);
  }

  const trialEnrollments = [...byUser.values()].filter(en => en.status === 'trial');
  const activeEnrollments = [...byUser.values()].filter(en => en.status === 'active');

  console.log(
    '[morning-messages] eligibility breakdown:',
    JSON.stringify({
      todayVN,
      total_eligible: breakdown.total,
      by_status: breakdown.by_status,
      by_channel: breakdown.by_channel,
      trial_expired_filtered: breakdown.trial_expired_filtered,
      after_user_dedup: { trial: trialEnrollments.length, active: activeEnrollments.length },
    }),
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TRIAL LOOP
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  for (const en of trialEnrollments) {
    const profile = en.profile;
    const userId = en.user_id;
    const channelUserId = profile.channel_user_id;
    const fcmToken = profile.fcm_token;

    console.log(
      '[morning-messages] processing trial user:',
      userId,
      'channel_user_id:',
      channelUserId,
      'fcm_token:',
      !!fcmToken,
    );

    if (sentUserIds.has(userId)) {
      console.log('[morning-messages] DEDUP SKIP (in-memory):', userId);
      skip(userId, 'trial: DEDUP in-memory – already sent in this run');
      continue;
    }

    if (!channelUserId && !fcmToken) {
      skip(userId, 'trial: no channel (channel_user_id and fcm_token both null)');
      continue;
    }

    if (await alreadySentToday(userId)) {
      sentUserIds.add(userId);
      skip(userId, 'trial: already sent morning_reminder today');
      continue;
    }

    // Helper đã lọc trial_ends_at < todayVN; defensive: kiểm tra lại theo timestamp
    // chính xác cho edge case trial vừa hết hạn giữa lúc query và lúc gửi.
    if (profile.trial_ends_at) {
      const end = new Date(profile.trial_ends_at).getTime();
      if (end <= Date.now()) {
        skip(userId, `trial: trial_ends_at (${profile.trial_ends_at}) already passed`);
        continue;
      }
    }

    const anchor = getTrialMorningAnchorDate(profile.bodix_start_date, en.enrolled_at);
    if (todayVN < anchor) {
      skip(userId, `trial: anchor date ${anchor} is in future (todayVN=${todayVN})`);
      continue;
    }

    const trialDay = calendarDaysBetween(anchor, todayVN) + 1;
    if (trialDay < 1 || trialDay > TRIAL_DAYS) {
      skip(userId, `trial: trialDay=${trialDay} out of range 1..${TRIAL_DAYS} (anchor=${anchor})`);
      continue;
    }

    const { data: workout } = await supabase
      .from('workout_templates')
      .select('day_number, title, workout_type, exercises')
      .eq('program_id', en.program_id)
      .eq('day_number', trialDay)
      .maybeSingle();

    if (!workout) {
      fail(userId, `trial: no workout_template for day ${trialDay}`);
      continue;
    }
    if (workout.workout_type === 'review') {
      fail(userId, `trial: workout_type=review for day ${trialDay} (unexpected in trial range)`);
      continue;
    }

    const displayName = profile.full_name?.split(' ').pop() || profile.full_name || 'bạn';
    const isWeekStart = trialDay === 1;
    const isRecovery = workout.workout_type === 'recovery';
    const contentTemplate = isRecovery ? 'morning_recovery_trial' : 'morning_main_trial';

    // Source of truth: workout_templates.exercises.items[].name (KHÔNG hardcode).
    const exerciseNames = getExerciseNames(workout.exercises as WorkoutExercises | null);
    if (!isRecovery && exerciseNames.length === 0) {
      fail(userId, `trial: no exercises.items for day ${trialDay} (title "${workout.title}")`);
      continue;
    }

    const workoutUrl = await buildWorkoutLink(
      userId,
      en.enrollment_id,
      `/app/trial/workout/${trialDay}`,
    );
    const zaloMessage = isRecovery
      ? buildTrialRecoveryMessage(displayName, trialDay, isWeekStart, workoutUrl)
      : buildTrialMainMessage(displayName, trialDay, exerciseNames, workout.title, isWeekStart, translationMap, workoutUrl);

    const logVars = {
      day_number: trialDay,
      workout_type: workout.workout_type,
      trial: true,
    };

    const chatContent = isRecovery
      ? `🧘 Ngày ${trialDay}/${TRIAL_DAYS} tập thử – Recovery\nHôm nay nhẹ nhàng – 1 lượt Recovery (~7 phút)`
      : `📅 Ngày ${trialDay}/${TRIAL_DAYS} tập thử – ${workout.title}\nMở app check-in: 3, 2 hoặc 1 lượt 💪`;

    let zaloDone = false;
    let zaloErrorDetail: string | null = null;
    if (channelUserId) {
      try {
        const result = await sendViaZalo(channelUserId, zaloMessage);
        if (result.success) {
          console.log('[morning-messages] Zalo sent:', userId);
          zaloDone = true;
          sentCount++;
          sentUserIds.add(userId);
          await supabase.from('nudge_logs').insert({
            user_id: userId,
            enrollment_id: en.enrollment_id,
            nudge_type: 'morning_reminder',
            channel: 'zalo',
            content_template: contentTemplate,
            content_variables: logVars,
            delivered: true,
          });
          await insertSupportSystemMessage(supabase, userId, chatContent);
        } else {
          zaloErrorDetail = result.error ?? 'unknown';
          console.error('[morning-messages] Zalo failed:', userId, zaloErrorDetail);
        }
      } catch (zaloErr) {
        zaloErrorDetail = zaloErr instanceof Error ? zaloErr.message : String(zaloErr);
        console.error('[morning-messages] Zalo threw:', userId, zaloErrorDetail);
      }
    }

    if (zaloDone) {
      await new Promise((r) => setTimeout(r, 100));
      continue;
    }

    if (fcmToken) {
      try {
        const pushTitle = isRecovery
          ? `Ngày ${trialDay}/${TRIAL_DAYS} tập thử – Recovery 🧘`
          : `Ngày ${trialDay}/${TRIAL_DAYS} tập thử – ${workout.title}`;
        const pushBody = isRecovery
          ? 'Hôm nay nhẹ nhàng – 1 lượt Recovery (~7 phút)'
          : 'Mở app check-in: 3, 2 hoặc 1 lượt 💪';

        const result = await sendFcmMessage(
          fcmToken,
          {
            type: 'morningWorkout',
            title: pushTitle,
            body: pushBody,
            data: {
              day_number: String(trialDay),
              workout_type: workout.workout_type,
              trial: 'true',
            },
          },
          userId,
        );

        if (result.success) {
          console.log('[morning-messages] FCM sent:', userId);
          sentCount++;
          sentUserIds.add(userId);
          await supabase.from('nudge_logs').insert({
            user_id: userId,
            enrollment_id: en.enrollment_id,
            nudge_type: 'morning_reminder',
            channel: 'push',
            content_template: contentTemplate,
            content_variables: logVars,
            delivered: true,
          });
          await insertSupportSystemMessage(supabase, userId, chatContent);
        } else {
          fail(userId, `trial: FCM failed (${result.error ?? 'unknown'})` + (zaloErrorDetail ? `, zalo earlier: ${zaloErrorDetail}` : ''));
        }
      } catch (fcmErr) {
        const msg = fcmErr instanceof Error ? fcmErr.message : String(fcmErr);
        fail(userId, `trial: FCM threw (${msg})` + (zaloErrorDetail ? `, zalo earlier: ${zaloErrorDetail}` : ''));
      }
    } else {
      fail(userId, `trial: Zalo failed (${zaloErrorDetail ?? 'no channelUserId'}) and no fcm_token fallback`);
    }

    await new Promise((r) => setTimeout(r, 100));
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // ACTIVE LOOP
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  for (const en of activeEnrollments) {
    const profile = en.profile;
    const userId = en.user_id;
    const channelUserId = profile.channel_user_id;
    const fcmToken = profile.fcm_token;

    // Defensive: nếu started_at sau hôm nay VN, user chưa đến ngày tập — skip
    if (en.started_at) {
      const startedYmd = isoTimestampToVietnamYmd(en.started_at);
      if (startedYmd > todayVN) {
        skip(userId, `active: started_at=${en.started_at} in future (todayVN=${todayVN})`);
        continue;
      }
    }

    const startAnchor: string =
      en.cohort_start_date ?? isoTimestampToVietnamYmd(en.enrolled_at);

    console.log(
      '[morning-messages] processing active user:',
      userId,
      'channel_user_id:',
      channelUserId,
      'fcm_token:',
      !!fcmToken,
    );

    if (sentUserIds.has(userId)) {
      console.log('[morning-messages] DEDUP SKIP (in-memory):', userId);
      skip(userId, 'active: DEDUP in-memory – already sent in trial loop or earlier');
      continue;
    }

    if (!channelUserId && !fcmToken) {
      skip(userId, 'active: no channel (channel_user_id and fcm_token both null)');
      continue;
    }

    if (await alreadySentToday(userId)) {
      sentUserIds.add(userId);
      skip(userId, 'active: already sent morning_reminder today');
      continue;
    }

    const dayNumber = calendarDaysBetween(startAnchor, todayVN) + 1;

    if (dayNumber < 1 || dayNumber > config.totalDays) {
      skip(userId, `active: dayNumber=${dayNumber} out of range 1..${config.totalDays} (startAnchor=${startAnchor})`);
      continue;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // CHỦ NHẬT — tin Review thay tin tập (chỉ user active)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (isSundayVN) {
      if (await alreadySentReviewToday(userId)) {
        sentUserIds.add(userId);
        skip(userId, 'active: already sent week_review today');
        continue;
      }

      // weekNumber = tuần vừa kết thúc (CN day 7/14/21 → 1/2/3). Clamp phòng lệch.
      const weekNumber = Math.min(3, Math.max(1, Math.ceil(dayNumber / 7)));
      const displayName =
        profile.full_name?.split(' ').pop() || profile.full_name || 'bạn';

      // Số buổi cá nhân + breakdown mode trong tuần T2–T7 (theo workout_date VN).
      const { data: weekCheckins } = await supabase
        .from('daily_checkins')
        .select('mode')
        .eq('enrollment_id', en.enrollment_id)
        .gte('workout_date', weekMonVN)
        .lte('workout_date', weekSatVN);
      const rowsW = weekCheckins ?? [];
      const personalCount = rowsW.length;
      const hardCount = rowsW.filter((c) => c.mode === 'hard').length;
      const lightCount = rowsW.filter((c) => c.mode === 'light').length;
      const easyCount = rowsW.filter((c) => c.mode === 'easy').length;
      const recoveryCount = rowsW.filter((c) => c.mode === 'recovery').length;

      // Số buổi cả đợt + tên cohort.
      let cohortCount = 0;
      let cohortName = 'cả lớp mình';
      if (en.cohort_id) {
        cohortCount = await getCohortWeekCount(en.cohort_id);
        const { data: cohortRow } = await supabase
          .from('cohorts')
          .select('name')
          .eq('id', en.cohort_id)
          .maybeSingle();
        if (cohortRow?.name) cohortName = cohortRow.name;
      }

      const { qa, video } = await getReviewContent(en.cohort_id);
      const reviewMessage = buildReviewMessage(
        displayName,
        cohortName,
        personalCount,
        cohortCount,
        qa,
        video,
      );

      // Tạo row weekly_reviews 'pending' (feeling_score=null) để webhook nhận 1–5.
      // Chỉ insert khi CHƯA có (tránh reset feeling_score nếu đã trả lời/đã publish).
      const { data: existingReview } = await supabase
        .from('weekly_reviews')
        .select('id')
        .eq('enrollment_id', en.enrollment_id)
        .eq('week_number', weekNumber)
        .maybeSingle();
      if (!existingReview) {
        const { error: wrError } = await supabase.from('weekly_reviews').insert({
          enrollment_id: en.enrollment_id,
          user_id: userId,
          week_number: weekNumber,
          week_completion_rate: personalCount / 6,
          week_hard_count: hardCount,
          week_light_count: lightCount,
          week_easy_count: easyCount,
          week_recovery_count: recoveryCount,
        });
        // 23505 = row vừa được tạo bởi run song song; bỏ qua, vẫn gửi tin.
        if (wrError && wrError.code !== '23505') {
          console.error('[morning-messages] weekly_reviews insert failed:', userId, wrError.message);
        }
      }

      const logVars = {
        week_number: weekNumber,
        personal_count: personalCount,
        cohort_count: cohortCount,
      };
      const chatContent =
        `🪞 Chủ nhật – Nhìn lại tuần ${weekNumber}\n` +
        `Bạn hoàn thành ${personalCount}/6 buổi. Trả lời 1 đến 5 để cho biết cảm nhận cơ thể nhé!`;

      let zaloDone = false;
      let zaloErrorDetail: string | null = null;
      if (channelUserId) {
        try {
          const result = await sendViaZalo(channelUserId, reviewMessage);
          if (result.success) {
            zaloDone = true;
            sentCount++;
            sentUserIds.add(userId);
            await supabase.from('nudge_logs').insert({
              user_id: userId,
              enrollment_id: en.enrollment_id,
              nudge_type: 'week_review',
              channel: 'zalo',
              content_template: 'sunday_review',
              content_variables: logVars,
              delivered: true,
            });
            await insertSupportSystemMessage(supabase, userId, chatContent);
          } else {
            zaloErrorDetail = result.error ?? 'unknown';
            console.error('[morning-messages] review Zalo failed:', userId, zaloErrorDetail);
          }
        } catch (zaloErr) {
          zaloErrorDetail = zaloErr instanceof Error ? zaloErr.message : String(zaloErr);
          console.error('[morning-messages] review Zalo threw:', userId, zaloErrorDetail);
        }
      }

      if (zaloDone) {
        await new Promise((r) => setTimeout(r, 100));
        continue;
      }

      if (fcmToken) {
        try {
          const result = await sendFcmMessage(
            fcmToken,
            {
              type: 'weekReview',
              title: `🪞 Chủ nhật – Nhìn lại tuần ${weekNumber}`,
              body: `Bạn hoàn thành ${personalCount}/6 buổi. Trả lời 1 đến 5 để cho biết cảm nhận nhé!`,
              data: { week_number: String(weekNumber) },
            },
            userId,
          );
          if (result.success) {
            sentCount++;
            sentUserIds.add(userId);
            await supabase.from('nudge_logs').insert({
              user_id: userId,
              enrollment_id: en.enrollment_id,
              nudge_type: 'week_review',
              channel: 'push',
              content_template: 'sunday_review',
              content_variables: logVars,
              delivered: true,
            });
            await insertSupportSystemMessage(supabase, userId, chatContent);
          } else {
            fail(userId, `active review: FCM failed (${result.error ?? 'unknown'})` + (zaloErrorDetail ? `, zalo earlier: ${zaloErrorDetail}` : ''));
          }
        } catch (fcmErr) {
          const msg = fcmErr instanceof Error ? fcmErr.message : String(fcmErr);
          fail(userId, `active review: FCM threw (${msg})` + (zaloErrorDetail ? `, zalo earlier: ${zaloErrorDetail}` : ''));
        }
      } else {
        fail(userId, `active review: Zalo failed (${zaloErrorDetail ?? 'no channelUserId'}) and no fcm_token fallback`);
      }

      await new Promise((r) => setTimeout(r, 100));
      continue;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // RESCUE PROTOCOL — tin sáng THÍCH ỨNG theo số ngày lỡ nhịp (chỉ active)
    // missedDays = số ngày TẬP (T2–T7, bỏ CN) lỡ liên tiếp gần nhất, đến hôm qua.
    // Rescue THAY tin tập (không gửi cả 2). >7 ngày → dừng tin sáng (chỉ giữ tin CN).
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const { data: lastCheckin } = await supabase
      .from('daily_checkins')
      .select('workout_date')
      .eq('enrollment_id', en.enrollment_id)
      .order('workout_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    const missedDays = countMissedWorkoutDays(
      lastCheckin?.workout_date ?? null,
      startAnchor,
      todayVN,
    );
    const level: RescueLevel = rescueLevel(missedDays);

    const rescueDisplayName =
      profile.full_name?.split(' ').pop() || profile.full_name || 'bạn';

    // >7 ngày lỡ → dormant: dừng tin sáng hằng ngày (tránh spam gây unfollow).
    // Chỉ còn tin Review CN hàng tuần. Quay lại check-in → missedDays reset → tự hồi phục.
    if (level === 'dormant') {
      rescueStats.dormant++;
      sentUserIds.add(userId);
      skip(userId, `active: dormant (missed=${missedDays} > 7) → dừng tin sáng, chỉ giữ tin CN`);
      continue;
    }

    // Buổi tập hôm nay — dùng chung cho CẢ tin rescue lẫn tin sáng bình thường.
    // Tin rescue = thăm hỏi + bài tập + link (thăm hỏi THÊM vào, không thay bài tập).
    const { data: workout } = await supabase
      .from('workout_templates')
      .select('day_number, title, workout_type, exercises')
      .eq('program_id', en.program_id)
      .eq('day_number', dayNumber)
      .maybeSingle();

    if (level === 'l1' || level === 'l2' || level === 'l3') {
      if (await alreadySentRescueToday(userId)) {
        sentUserIds.add(userId);
        skip(userId, `active: already sent rescue (${level}) today`);
        continue;
      }

      // Không có workout_template (ngày lỗi dữ liệu) → vẫn gửi thăm hỏi, bỏ khối bài tập.
      // Ngày Recovery → items rỗng, chỉ hiện tên buổi + link.
      let rescueCtx: RescueWorkoutContext | null = null;
      if (workout && workout.workout_type !== 'review') {
        const rescueExercises = getExerciseNames(workout.exercises as WorkoutExercises | null);
        rescueCtx = {
          sessionTitle: workout.title,
          exerciseLines: rescueExercises.map((ex) => translateExerciseName(ex, translationMap)),
          workoutUrl: await buildWorkoutLink(
            userId,
            en.enrollment_id,
            `/app/program/workout/${dayNumber}`,
          ),
        };
      } else {
        console.warn(
          '[morning-messages] rescue without workout block:',
          userId, `day=${dayNumber}`, `type=${workout?.workout_type ?? 'missing'}`,
        );
      }

      const rescueText = buildRescueMessage(level, rescueDisplayName, rescueCtx)!;
      const nudgeType =
        level === 'l1' ? 'rescue_soft' : level === 'l2' ? 'rescue_urgent' : 'rescue_critical';
      const triggerReason = level === 'l1' ? 'missed_2_days' : 'missed_3_plus_days';
      const contentTemplate = `rescue_${level}`;
      const logVars = { missed_days: missedDays, level };
      const pushTitle =
        level === 'l1'
          ? `${rescueDisplayName} ơi, mình chưa thấy bạn 💚`
          : `${rescueDisplayName} ơi, mình nhớ bạn 💚`;
      const pushBody = 'Chỉ 1 lượt Easy (~7 phút) là quay lại nhịp. Mở app nhé!';

      let zaloDone = false;
      let zaloErrorDetail: string | null = null;
      if (channelUserId) {
        try {
          const result = await sendViaZalo(channelUserId, rescueText);
          if (result.success) {
            zaloDone = true;
            sentCount++;
            rescueStats[level]++;
            sentUserIds.add(userId);
            await supabase.from('rescue_interventions').insert({
              enrollment_id: en.enrollment_id,
              user_id: userId,
              trigger_reason: triggerReason,
              action_taken: 'send_rescue_message',
              message_sent: rescueText,
              outcome: 'pending',
              // Mở cửa sổ 48h: tin text user nhắn lại = tâm sự → bot trả lời ấm áp
              // + flag cho Founder, KHÔNG rơi vào FAQ/fallback.
              awaiting_reply_until: rescueAwaitingUntil(),
            });
            await supabase.from('nudge_logs').insert({
              user_id: userId,
              enrollment_id: en.enrollment_id,
              nudge_type: nudgeType,
              channel: 'zalo',
              content_template: contentTemplate,
              content_variables: logVars,
              delivered: true,
            });
            await insertSupportSystemMessage(supabase, userId, rescueText);
          } else {
            zaloErrorDetail = result.error ?? 'unknown';
            console.error('[morning-messages] rescue Zalo failed:', userId, zaloErrorDetail);
          }
        } catch (zaloErr) {
          zaloErrorDetail = zaloErr instanceof Error ? zaloErr.message : String(zaloErr);
          console.error('[morning-messages] rescue Zalo threw:', userId, zaloErrorDetail);
        }
      }

      if (zaloDone) {
        await new Promise((r) => setTimeout(r, 100));
        continue;
      }

      if (fcmToken) {
        try {
          const result = await sendFcmMessage(
            fcmToken,
            {
              type: 'rescue',
              title: pushTitle,
              body: pushBody,
              data: { missed_days: String(missedDays), level },
            },
            userId,
          );
          if (result.success) {
            sentCount++;
            rescueStats[level]++;
            sentUserIds.add(userId);
            await supabase.from('rescue_interventions').insert({
              enrollment_id: en.enrollment_id,
              user_id: userId,
              trigger_reason: triggerReason,
              action_taken: 'send_rescue_message',
              message_sent: `push:rescue_${level}`,
              outcome: 'pending',
              awaiting_reply_until: rescueAwaitingUntil(),
            });
            await supabase.from('nudge_logs').insert({
              user_id: userId,
              enrollment_id: en.enrollment_id,
              nudge_type: nudgeType,
              channel: 'push',
              content_template: contentTemplate,
              content_variables: logVars,
              delivered: true,
            });
            await insertSupportSystemMessage(supabase, userId, rescueText);
          } else {
            fail(userId, `active rescue: FCM failed (${result.error ?? 'unknown'})` + (zaloErrorDetail ? `, zalo earlier: ${zaloErrorDetail}` : ''));
          }
        } catch (fcmErr) {
          const msg = fcmErr instanceof Error ? fcmErr.message : String(fcmErr);
          fail(userId, `active rescue: FCM threw (${msg})` + (zaloErrorDetail ? `, zalo earlier: ${zaloErrorDetail}` : ''));
        }
      } else {
        fail(userId, `active rescue: Zalo failed (${zaloErrorDetail ?? 'no channelUserId'}) and no fcm_token fallback`);
      }

      await new Promise((r) => setTimeout(r, 100));
      continue;
    }

    // ── level 'normal' (0–1 ngày lỡ) → tin sáng bình thường bên dưới. ──
    // Nếu user vừa quay lại HÔM QUA sau khi có rescue đang 'pending' → thêm câu chào mừng
    // và đánh dấu rescue đã dẫn tới quay lại (outcome='user_returned').
    let welcomePrefix = '';
    if (lastCheckin?.workout_date === yesterdayVN) {
      const { data: pendingRescue } = await supabase
        .from('rescue_interventions')
        .select('id')
        .eq('enrollment_id', en.enrollment_id)
        .eq('outcome', 'pending')
        .limit(1)
        .maybeSingle();
      if (pendingRescue) {
        welcomePrefix = `${WELCOME_BACK_LINE}\n\n`;
        rescueStats.welcome_back++;
        await supabase
          .from('rescue_interventions')
          .update({
            outcome: 'user_returned',
            outcome_at: new Date().toISOString(),
            // User đã quay lại → đóng luôn cửa sổ chờ tâm sự (phòng khi check-in
            // đến từ đường khác chưa kịp clear).
            awaiting_reply_until: null,
          })
          .eq('enrollment_id', en.enrollment_id)
          .eq('outcome', 'pending');
      }
    }

    if (!workout) {
      fail(userId, `active: no workout_template for day ${dayNumber}`);
      continue;
    }

    const workoutType: string = workout.workout_type;

    if (workoutType === 'review') {
      skip(userId, `active: workout_type=review for day ${dayNumber} (Chủ nhật)`);
      continue;
    }

    const displayName = profile.full_name?.split(' ').pop() || profile.full_name || 'bạn';
    const isWeekStart = [1, 8, 15].includes(dayNumber);
    const isRecovery = workoutType === 'recovery';
    const contentTemplate = isRecovery ? 'morning_recovery' : 'morning_main';

    // Source of truth: workout_templates.exercises.items[].name (KHÔNG hardcode).
    const exerciseNames = getExerciseNames(workout.exercises as WorkoutExercises | null);
    if (!isRecovery && exerciseNames.length === 0) {
      fail(userId, `active: no exercises.items for day ${dayNumber} (title "${workout.title}")`);
      continue;
    }

    const workoutUrl = await buildWorkoutLink(
      userId,
      en.enrollment_id,
      `/app/program/workout/${dayNumber}`,
    );
    const zaloMessage = welcomePrefix + (isRecovery
      ? buildRecoveryMessage(displayName, dayNumber, config.totalDays, isWeekStart, workoutUrl)
      : buildMainMessage(displayName, dayNumber, config.totalDays, exerciseNames, workout.title, isWeekStart, translationMap, workoutUrl));

    const logVars = { day_number: dayNumber, workout_type: workoutType };

    const chatContent = isRecovery
      ? `🧘 Ngày ${dayNumber}/${config.totalDays} – Recovery\nHôm nay nhẹ nhàng – 1 lượt Recovery (~7 phút)`
      : `📅 Ngày ${dayNumber}/${config.totalDays} – ${workout.title}\nMở app check-in: 3, 2 hoặc 1 lượt 💪`;

    let zaloDone = false;
    let zaloErrorDetail: string | null = null;
    if (channelUserId) {
      try {
        const result = await sendViaZalo(channelUserId, zaloMessage);
        if (result.success) {
          console.log('[morning-messages] Zalo sent:', userId);
          zaloDone = true;
          sentCount++;
          sentUserIds.add(userId);
          await supabase.from('nudge_logs').insert({
            user_id: userId,
            enrollment_id: en.enrollment_id,
            nudge_type: 'morning_reminder',
            channel: 'zalo',
            content_template: contentTemplate,
            content_variables: logVars,
            delivered: true,
          });
          await insertSupportSystemMessage(supabase, userId, chatContent);
        } else {
          zaloErrorDetail = result.error ?? 'unknown';
          console.error('[morning-messages] Zalo failed:', userId, zaloErrorDetail);
        }
      } catch (zaloErr) {
        zaloErrorDetail = zaloErr instanceof Error ? zaloErr.message : String(zaloErr);
        console.error('[morning-messages] Zalo threw:', userId, zaloErrorDetail);
      }
    }

    if (zaloDone) {
      await new Promise((r) => setTimeout(r, 100));
      continue;
    }

    if (fcmToken) {
      try {
        const pushTitle = isRecovery
          ? `Ngày ${dayNumber}/${config.totalDays} – Recovery 🧘`
          : `Ngày ${dayNumber}/${config.totalDays} – ${workout.title}`;
        const pushBody = isRecovery
          ? 'Hôm nay nhẹ nhàng – 1 lượt Recovery (~7 phút)'
          : 'Mở app check-in: 3, 2 hoặc 1 lượt 💪';

        const result = await sendFcmMessage(
          fcmToken,
          {
            type: 'morningWorkout',
            title: pushTitle,
            body: pushBody,
            data: {
              day_number: String(dayNumber),
              workout_type: workoutType,
            },
          },
          userId,
        );

        if (result.success) {
          console.log('[morning-messages] FCM sent:', userId);
          sentCount++;
          sentUserIds.add(userId);
          await supabase.from('nudge_logs').insert({
            user_id: userId,
            enrollment_id: en.enrollment_id,
            nudge_type: 'morning_reminder',
            channel: 'push',
            content_template: contentTemplate,
            content_variables: logVars,
            delivered: true,
          });
          await insertSupportSystemMessage(supabase, userId, chatContent);
        } else {
          fail(userId, `active: FCM failed (${result.error ?? 'unknown'})` + (zaloErrorDetail ? `, zalo earlier: ${zaloErrorDetail}` : ''));
        }
      } catch (fcmErr) {
        const msg = fcmErr instanceof Error ? fcmErr.message : String(fcmErr);
        fail(userId, `active: FCM threw (${msg})` + (zaloErrorDetail ? `, zalo earlier: ${zaloErrorDetail}` : ''));
      }
    } else {
      fail(userId, `active: Zalo failed (${zaloErrorDetail ?? 'no channelUserId'}) and no fcm_token fallback`);
    }

    await new Promise(r => setTimeout(r, 100));
  }

  const summary = {
    cron: 'morning-messages',
    todayVN,
    eligible_count: breakdown.total,
    by_status: breakdown.by_status,
    by_channel: breakdown.by_channel,
    sent: sentCount,
    skipped: skippedCount,
    errors: errorCount,
    rescue: rescueStats,
    trial_expired_filtered: breakdown.trial_expired_filtered,
    active_total: activeEnrollments.length,
    trial_total: trialEnrollments.length,
    skip_reasons: skipReasons,
    error_reasons: errorReasons,
  };

  console.log('[morning-messages] summary:', JSON.stringify(summary));

  return NextResponse.json(summary);
}

export async function GET(request: NextRequest) {
  return handleMorningMessages(request);
}

export async function POST(request: NextRequest) {
  return handleMorningMessages(request);
}
