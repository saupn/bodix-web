import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sendViaZalo } from '@/lib/messaging/adapters/zalo';

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
// BUILD MESSAGES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildMainMessage(
  name: string,
  dayNumber: number,
  totalDays: number,
  session: SessionMeta,
  isWeekStart: boolean,
): string {
  const exerciseList = session.exercises.map(ex => `- ${ex}`).join('\n');
  const weekStartTip = isWeekStart
    ? '\n\n💡 Tuần này có thắc mắc gì — nhắn mình bất cứ lúc nào nha!'
    : '';

  return (
    `Hi ${name}! 🌸 Ngày ${dayNumber}/${totalDays} — hôm nay tập ${session.focus} nhé!\n` +
    `\n` +
    `Session ${session.code}:\n` +
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
// ROUTE HANDLER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function GET(request: NextRequest) {
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

  // Lấy enrollments active + profile + cohort
  const { data: enrollments, error: enrollError } = await supabase
    .from('enrollments')
    .select(`
      id,
      user_id,
      program_id,
      cohort_id,
      cohorts!inner ( start_date ),
      profiles!inner (
        id,
        full_name,
        channel_user_id
      )
    `)
    .eq('status', 'active')
    .eq('program_id', program.id);

  if (enrollError) {
    console.error('[morning-messages] enrollments query:', enrollError);
    return NextResponse.json({ sent: 0, skipped: 0, errors: 1, message: enrollError.message }, { status: 500 });
  }

  if (!enrollments || enrollments.length === 0) {
    return NextResponse.json({ sent: 0, skipped: 0, errors: 0, message: 'No active enrollments' });
  }

  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD (UTC)
  let sentCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const row of enrollments) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enrollment = row as any;
    const profile = Array.isArray(enrollment.profiles) ? enrollment.profiles[0] : enrollment.profiles;
    const cohort = Array.isArray(enrollment.cohorts) ? enrollment.cohorts[0] : enrollment.cohorts;
    const channelUserId: string | null = profile?.channel_user_id;

    if (!channelUserId || !cohort?.start_date) {
      skippedCount++;
      continue;
    }

    // Tính day_number từ cohort start_date
    const startDate = new Date(cohort.start_date + 'T00:00:00Z');
    const todayDate = new Date(today + 'T00:00:00Z');
    const dayNumber = Math.floor((todayDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    if (dayNumber < 1 || dayNumber > config.totalDays) {
      skippedCount++;
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
      errorCount++;
      continue;
    }

    const workoutType: string = workout.workout_type;

    // Review → skip
    if (workoutType === 'review') {
      skippedCount++;
      continue;
    }

    const displayName = profile.full_name?.split(' ').pop() || profile.full_name || 'bạn';
    const isWeekStart = [1, 8, 15].includes(dayNumber);
    let message: string;

    if (workoutType === 'recovery') {
      message = buildRecoveryMessage(displayName, dayNumber, config.totalDays, isWeekStart);
    } else {
      // Main workout — resolve session code from title
      const sessionCode = TITLE_TO_SESSION[workout.title] ?? null;
      const session = sessionCode ? SESSIONS[sessionCode] : null;

      if (!session) {
        // Fallback nếu không map được title
        console.error(`[morning-messages] Unknown session title: "${workout.title}" for day ${dayNumber}`);
        errorCount++;
        continue;
      }

      message = buildMainMessage(displayName, dayNumber, config.totalDays, session, isWeekStart);
    }

    try {
      const result = await sendViaZalo(channelUserId, message);

      if (result.success) {
        sentCount++;

        // Insert nudge_logs
        await supabase.from('nudge_logs').insert({
          user_id: profile.id,
          enrollment_id: enrollment.id,
          nudge_type: 'morning_reminder',
          channel: 'zalo',
          content_template: workoutType === 'recovery' ? 'morning_recovery' : 'morning_main',
          content_variables: { day_number: dayNumber, workout_type: workoutType },
          delivered: true,
        });
      } else {
        console.error(`[morning-messages] Failed for user ${profile.id}:`, result.error);
        errorCount++;
      }
    } catch (err) {
      console.error(`[morning-messages] Error sending to user ${profile.id}:`, err);
      errorCount++;
    }

    // Rate limit: 100ms giữa mỗi tin
    await new Promise(r => setTimeout(r, 100));
  }

  return NextResponse.json({
    sent: sentCount,
    skipped: skippedCount,
    errors: errorCount,
    total: enrollments.length,
  });
}
