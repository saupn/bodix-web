import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sendViaZalo } from '@/lib/messaging/adapters/zalo';
import { sendFcmMessage } from '@/lib/messaging/adapters/push';
import { insertSupportSystemMessage } from '@/lib/messaging/chat-mirror';
import {
  calendarDaysBetween,
  getVietnamDateString,
  isoTimestampToVietnamYmd,
} from '@/lib/date/vietnam';
import { getTrialMorningAnchorDate, TRIAL_DAYS } from '@/lib/trial/utils';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Session metadata (source: lib/workout/video-config.ts)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type SessionCode = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

interface SessionMeta {
  code: SessionCode;
  focus: string;
  exercises: string[];
}

const SESSIONS: Record<SessionCode, SessionMeta> = {
  A: {
    code: 'A',
    focus: 'Mông, đùi, bắp chân',
    exercises: ['Squat', 'Lunge', 'Glute Bridge', 'Calf Raise', 'Wall Sit'],
  },
  B: {
    code: 'B',
    focus: 'Vai, tay, ngực',
    exercises: ['Push-up', 'Shoulder Press', 'Tricep Dip', 'Arm Circle', 'Plank Shoulder Tap'],
  },
  C: {
    code: 'C',
    focus: 'Tim mạch, sức bền',
    exercises: ['March in Place', 'Step Touch', 'Low Jack', 'Knee Lift', 'Side Step'],
  },
  D: {
    code: 'D',
    focus: 'Bụng, lưng, cơ sâu',
    exercises: ['Plank', 'Dead Bug', 'Bird Dog', 'Crunch', 'Side Plank'],
  },
  E: {
    code: 'E',
    focus: 'Toàn thân liên tục',
    exercises: ['Burpee nhẹ', 'Mountain Climber', 'Squat to Press', 'Lunge Twist', 'Inchworm'],
  },
  F: {
    code: 'F',
    focus: 'Giãn cơ, thư giãn',
    exercises: ['Cat-Cow', 'Child\'s Pose', 'Hip Opener', 'Hamstring Stretch', 'Shoulder Stretch'],
  },
};

// Title in workout_templates → session code
const TITLE_TO_SESSION: Record<string, SessionCode> = {
  'Nền tảng thân dưới': 'A',
  'Thân trên & Tư thế': 'B',
  'Cardio nhẹ nhàng': 'C',
  'Cơ trung tâm & Cân bằng': 'D',
  'Toàn thân linh hoạt': 'E',
  'Phục hồi & Linh hoạt': 'F',
};

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
  session: SessionMeta,
  sessionTitle: string,
  isWeekStart: boolean,
): string {
  const exerciseList = session.exercises.map(ex => `- ${ex}`).join('\n');
  const weekStartTip = isWeekStart
    ? '\n\n💡 Tuần này có thắc mắc gì — nhắn mình bất cứ lúc nào nha!'
    : '';

  return (
    `Hi ${name}! 🌸 Ngày ${dayNumber}/${totalDays} — hôm nay mình cùng nhau tập ${sessionTitle}. Các bài tập gồm:\n` +
    `${exerciseList}\n` +
    `\n` +
    `▶️ Xem video: https://bodix.fit/app/program/workout/${dayNumber}\n` +
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
): string {
  const weekStartTip = isWeekStart
    ? '\n\n💡 Tuần này có thắc mắc gì — nhắn mình bất cứ lúc nào nha!'
    : '';

  return (
    `Hi ${name}! 🧘 Ngày ${dayNumber}/${totalDays} — hôm nay nhẹ nhàng thôi nha.\n` +
    `\n` +
    `Recovery giúp cơ thể phục hồi. 1 lượt (~7 phút).\n` +
    `\n` +
    `▶️ Xem video: https://bodix.fit/app/program/workout/${dayNumber}\n` +
    `\n` +
    `Xong rồi nhắn 1 nha!` +
    weekStartTip
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BUILD MESSAGES — trial (D1–D3, thân mật)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildTrialMainMessage(
  name: string,
  trialDay: number,
  session: SessionMeta,
  sessionTitle: string,
  isWeekStart: boolean,
): string {
  const exerciseList = session.exercises.map(ex => `- ${ex}`).join('\n');
  const weekTip = isWeekStart
    ? '\n\n💬 Có gì thắc mắc cứ nhắn mình nha — đang tập thử mà, thoải mái đi!'
    : '';

  return (
    `Chào ${name} ơi! 🌿 Ngày ${trialDay}/${TRIAL_DAYS} tập thử — hôm nay mình cùng nhau tập ${sessionTitle}. Các bài tập gồm:\n` +
    `${exerciseList}\n` +
    `\n` +
    `▶️ Xem bài: https://bodix.fit/app/trial/workout/${trialDay}\n` +
    `\n` +
    `Tập xong nhắn qua đây:\n` +
    `  3 → đủ 3 lượt (~21 phút)\n` +
    `  2 → 2 lượt (~14 phút)\n` +
    `  1 → 1 lượt (~7 phút)\n` +
    `\n` +
    `Cả 3 đều tính hoàn thành — cứ từ từ, quan trọng là bạn không bỏ cuộc! 💪` +
    weekTip
  );
}

function buildTrialRecoveryMessage(
  name: string,
  trialDay: number,
  isWeekStart: boolean,
): string {
  const weekTip = isWeekStart
    ? '\n\n💬 Có gì thắc mắc cứ nhắn mình nha!'
    : '';

  return (
    `Chào ${name}! 🧘 Ngày ${trialDay}/${TRIAL_DAYS} tập thử — hôm nay cho cơ thể phục hồi nhẹ nhàng thôi nha.\n` +
    `\n` +
    `Recovery ~7 phút một lượt.\n` +
    `\n` +
    `▶️ Xem bài: https://bodix.fit/app/trial/workout/${trialDay}\n` +
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
  const todayVNStartUtc = new Date(`${todayVN}T00:00:00+07:00`).toISOString();
  let sentCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
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

  // ── Trial: status = trial, ngày 1–3 theo bodix_start_date hoặc enrolled_at + 1 ──
  const { data: trialEnrollments, error: trialErr } = await supabase
    .from('enrollments')
    .select(`
      id,
      user_id,
      program_id,
      enrolled_at,
      profiles!inner (
        id,
        full_name,
        channel_user_id,
        fcm_token,
        notification_via,
        bodix_start_date,
        trial_ends_at
      )
    `)
    .eq('status', 'trial')
    .eq('program_id', program.id);

  if (trialErr) {
    console.error('[morning-messages] trial enrollments:', trialErr);
  } else if (trialEnrollments?.length) {
    // Dedup enrollments theo user_id: nếu query trả nhiều rows cùng user, chỉ giữ 1
    const trialByUser = new Map<string, (typeof trialEnrollments)[number]>();
    for (const row of trialEnrollments) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const profile = Array.isArray((row as any).profiles) ? (row as any).profiles[0] : (row as any).profiles;
      const uid: string | undefined = profile?.id;
      if (!uid) continue;
      if (!trialByUser.has(uid)) trialByUser.set(uid, row);
    }

    for (const row of trialByUser.values()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const en = row as any;
      const profile = Array.isArray(en.profiles) ? en.profiles[0] : en.profiles;
      const userId: string = profile?.id;
      const channelUserId: string | null = profile?.channel_user_id ?? null;
      const fcmToken: string | null = profile?.fcm_token ?? null;
      const enrolledAt: string = en.enrolled_at;

      console.log(
        '[morning-messages] processing trial user:',
        userId,
        'channel_user_id:',
        channelUserId,
        'fcm_token:',
        !!fcmToken,
      );

      // Lớp 1: in-memory dedup — nếu vì lý do gì đó user đã được gửi trong cùng run
      if (sentUserIds.has(userId)) {
        console.log('[morning-messages] DEDUP SKIP (in-memory):', userId);
        skip(userId, 'trial: DEDUP in-memory — already sent in this run');
        continue;
      }

      if (!channelUserId && !fcmToken) {
        skip(userId, 'trial: no channel (channel_user_id and fcm_token both null)');
        continue;
      }

      // Lớp 2: nudge_logs dedup — backup cho cron overlap giữa 2 lần chạy
      if (await alreadySentToday(userId)) {
        sentUserIds.add(userId);
        skip(userId, 'trial: already sent morning_reminder today');
        continue;
      }

      if (profile?.trial_ends_at) {
        const end = new Date(profile.trial_ends_at).getTime();
        if (end <= Date.now()) {
          skip(userId, `trial: trial_ends_at (${profile.trial_ends_at}) already passed`);
          continue;
        }
      }

      const anchor = getTrialMorningAnchorDate(profile?.bodix_start_date, enrolledAt);
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
        .select('day_number, title, workout_type')
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

      let session: SessionMeta | null = null;
      if (!isRecovery) {
        const sessionCode = TITLE_TO_SESSION[workout.title] ?? null;
        session = sessionCode ? SESSIONS[sessionCode] : null;
        if (!session) {
          fail(userId, `trial: unknown session title "${workout.title}"`);
          continue;
        }
      }

      const zaloMessage = isRecovery
        ? buildTrialRecoveryMessage(displayName, trialDay, isWeekStart)
        : buildTrialMainMessage(displayName, trialDay, session!, workout.title, isWeekStart);

      const logVars = {
        day_number: trialDay,
        workout_type: workout.workout_type,
        trial: true,
      };

      // Chat mirror — hiện trong BodiX Support history (app user)
      const chatContent = isRecovery
        ? `🧘 Ngày ${trialDay}/${TRIAL_DAYS} tập thử — Recovery\nHôm nay nhẹ nhàng — 1 lượt Recovery (~7 phút)`
        : `📅 Ngày ${trialDay}/${TRIAL_DAYS} tập thử — ${workout.title}\nMở app check-in: 3, 2 hoặc 1 lượt 💪`;

      // BƯỚC 1: Ưu tiên Zalo
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
              enrollment_id: en.id,
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

      // BƯỚC 2: Fallback FCM
      if (fcmToken) {
        try {
          const pushTitle = isRecovery
            ? `Ngày ${trialDay}/${TRIAL_DAYS} tập thử — Recovery 🧘`
            : `Ngày ${trialDay}/${TRIAL_DAYS} tập thử — ${workout.title}`;
          const pushBody = isRecovery
            ? 'Hôm nay nhẹ nhàng — 1 lượt Recovery (~7 phút)'
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
              enrollment_id: en.id,
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
  }

  // Lấy enrollments active + profile; cohort optional (fallback enrolled_at)
  const { data: enrollments, error: enrollError } = await supabase
    .from('enrollments')
    .select(`
      id,
      user_id,
      program_id,
      cohort_id,
      enrolled_at,
      cohorts ( start_date ),
      profiles!inner (
        id,
        full_name,
        channel_user_id,
        fcm_token,
        notification_via
      )
    `)
    .eq('status', 'active')
    .eq('program_id', program.id);

  if (enrollError) {
    console.error('[morning-messages] enrollments query:', enrollError);
    return NextResponse.json(
      {
        sent: sentCount,
        skipped: skippedCount,
        errors: errorCount + 1,
        message: enrollError.message,
        skip_reasons: skipReasons,
        error_reasons: errorReasons,
      },
      { status: 500 }
    );
  }

  if (!enrollments || enrollments.length === 0) {
    return NextResponse.json({
      sent: sentCount,
      skipped: skippedCount,
      errors: errorCount,
      trial_processed: true,
      active_total: 0,
      message: 'No active enrollments',
      skip_reasons: skipReasons,
      error_reasons: errorReasons,
    });
  }

  // Dedup enrollments theo user_id: nếu user có nhiều rows active (re-enrollment, anomaly),
  // chỉ giữ 1 row để tránh gửi 2 tin trong cùng loop
  const activeByUser = new Map<string, (typeof enrollments)[number]>();
  for (const row of enrollments) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profile = Array.isArray((row as any).profiles) ? (row as any).profiles[0] : (row as any).profiles;
    const uid: string | undefined = profile?.id;
    if (!uid) continue;
    if (!activeByUser.has(uid)) activeByUser.set(uid, row);
  }

  for (const row of activeByUser.values()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enrollment = row as any;
    const profile = Array.isArray(enrollment.profiles) ? enrollment.profiles[0] : enrollment.profiles;
    const cohort = Array.isArray(enrollment.cohorts) ? enrollment.cohorts[0] : enrollment.cohorts;
    const userId: string = profile?.id;
    const channelUserId: string | null = profile?.channel_user_id ?? null;
    const fcmToken: string | null = profile?.fcm_token ?? null;

    const startAnchor: string =
      cohort?.start_date ?? isoTimestampToVietnamYmd(enrollment.enrolled_at as string);

    console.log(
      '[morning-messages] processing active user:',
      userId,
      'channel_user_id:',
      channelUserId,
      'fcm_token:',
      !!fcmToken,
    );

    // Lớp 1: in-memory dedup — quan trọng nhất cho case user có cả trial và active enrollment
    if (sentUserIds.has(userId)) {
      console.log('[morning-messages] DEDUP SKIP (in-memory):', userId);
      skip(userId, 'active: DEDUP in-memory — already sent in trial loop or earlier');
      continue;
    }

    if (!channelUserId && !fcmToken) {
      skip(userId, 'active: no channel (channel_user_id and fcm_token both null)');
      continue;
    }

    // Lớp 2: nudge_logs dedup
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

    // Lấy workout template
    const { data: workout } = await supabase
      .from('workout_templates')
      .select('day_number, title, workout_type')
      .eq('program_id', enrollment.program_id)
      .eq('day_number', dayNumber)
      .maybeSingle();

    if (!workout) {
      fail(userId, `active: no workout_template for day ${dayNumber}`);
      continue;
    }

    const workoutType: string = workout.workout_type;

    // Review → skip
    if (workoutType === 'review') {
      skip(userId, `active: workout_type=review for day ${dayNumber} (Chủ nhật)`);
      continue;
    }

    const displayName = profile.full_name?.split(' ').pop() || profile.full_name || 'bạn';
    const isWeekStart = [1, 8, 15].includes(dayNumber);
    const isRecovery = workoutType === 'recovery';
    const contentTemplate = isRecovery ? 'morning_recovery' : 'morning_main';

    let session: SessionMeta | null = null;
    if (!isRecovery) {
      const sessionCode = TITLE_TO_SESSION[workout.title] ?? null;
      session = sessionCode ? SESSIONS[sessionCode] : null;
      if (!session) {
        fail(userId, `active: unknown session title "${workout.title}" for day ${dayNumber}`);
        continue;
      }
    }

    const zaloMessage = isRecovery
      ? buildRecoveryMessage(displayName, dayNumber, config.totalDays, isWeekStart)
      : buildMainMessage(displayName, dayNumber, config.totalDays, session!, workout.title, isWeekStart);

    const logVars = { day_number: dayNumber, workout_type: workoutType };

    // Chat mirror — hiện trong BodiX Support history (app user)
    const chatContent = isRecovery
      ? `🧘 Ngày ${dayNumber}/${config.totalDays} — Recovery\nHôm nay nhẹ nhàng — 1 lượt Recovery (~7 phút)`
      : `📅 Ngày ${dayNumber}/${config.totalDays} — ${workout.title}\nMở app check-in: 3, 2 hoặc 1 lượt 💪`;

    // BƯỚC 1: Ưu tiên Zalo
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
            enrollment_id: enrollment.id,
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

    // BƯỚC 2: Fallback FCM
    if (fcmToken) {
      try {
        const pushTitle = isRecovery
          ? `Ngày ${dayNumber}/${config.totalDays} — Recovery 🧘`
          : `Ngày ${dayNumber}/${config.totalDays} — ${workout.title}`;
        const pushBody = isRecovery
          ? 'Hôm nay nhẹ nhàng — 1 lượt Recovery (~7 phút)'
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
            enrollment_id: enrollment.id,
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

    // Rate limit: 100ms giữa mỗi tin
    await new Promise(r => setTimeout(r, 100));
  }

  return NextResponse.json({
    sent: sentCount,
    skipped: skippedCount,
    errors: errorCount,
    active_total: enrollments.length,
    skip_reasons: skipReasons,
    error_reasons: errorReasons,
  });
}

export async function GET(request: NextRequest) {
  return handleMorningMessages(request);
}

export async function POST(request: NextRequest) {
  return handleMorningMessages(request);
}
