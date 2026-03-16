import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendMessage } from '@/lib/messaging';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type WorkoutVersion = { video_url?: string } | null;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Lấy program BodiX 21
  const { data: program } = await supabase
    .from('programs')
    .select('id')
    .eq('slug', 'bodix-21')
    .single();

  if (!program) {
    return NextResponse.json({ sent: 0, message: 'Program bodix-21 not found' });
  }

  // Lấy enrollments active (BodiX 21, chưa vượt ngày 21) + profile
  const { data: enrollments, error: enrollError } = await supabase
    .from('enrollments')
    .select(`
      id,
      current_day,
      user_id,
      program_id,
      profiles!inner (
        id,
        full_name,
        channel_user_id,
        preferred_channel
      )
    `)
    .eq('status', 'active')
    .eq('program_id', program.id)
    .lt('current_day', 21);

  if (enrollError) {
    console.error('[morning-messages] enrollments query:', enrollError);
    return NextResponse.json({ sent: 0, errors: 1, message: enrollError.message }, { status: 500 });
  }

  if (!enrollments || enrollments.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No active enrollments' });
  }

  let sentCount = 0;
  let errorCount = 0;

  for (const row of enrollments) {
    const enrollment = row as {
      id: string;
      current_day: number;
      user_id: string;
      program_id: string;
      profiles: { id: string; full_name: string | null; channel_user_id: string; preferred_channel: string | null } | { id: string; full_name: string | null; channel_user_id: string; preferred_channel: string | null }[];
    };

    const profile = Array.isArray(enrollment.profiles) ? enrollment.profiles[0] : enrollment.profiles;
    const channelUserId = profile?.channel_user_id;
    const channel = (profile?.preferred_channel as 'zalo' | 'whatsapp') || 'zalo';

    if (!channelUserId) continue;

    const dayNumber = enrollment.current_day + 1;

    // Lấy workout template cho ngày hiện tại
    const { data: workout, error: workoutError } = await supabase
      .from('workout_templates')
      .select('day_number, title, description, hard_version, light_version, recovery_version')
      .eq('program_id', enrollment.program_id)
      .eq('day_number', dayNumber)
      .maybeSingle();

    if (workoutError || !workout) {
      errorCount++;
      continue;
    }

    const hardUrl = (workout.hard_version as WorkoutVersion)?.video_url ?? '';
    const lightUrl = (workout.light_version as WorkoutVersion)?.video_url ?? '';
    const easyUrl =
      (workout.recovery_version as WorkoutVersion)?.video_url ??
      (workout.light_version as WorkoutVersion)?.video_url ??
      '';

    const morningText = workout.title ?? `Ngày ${dayNumber}`;
    const text =
      `${morningText}\n\n` +
      (workout.description ? `${workout.description}\n\n` : '') +
      `🔥 Hard (3 lượt): ${hardUrl || '(xem trong app)'}\n` +
      `💪 Light (2 lượt): ${lightUrl || '(xem trong app)'}\n` +
      `✅ Easy (1 lượt): ${easyUrl || '(xem trong app)'}\n\n` +
      `Tập xong reply: HARD / LIGHT / EASY`;

    try {
      const result = await sendMessage({
        userId: profile.id,
        channel,
        channelUserId,
        text,
      });

      if (result.success) {
        sentCount++;
      } else {
        console.error(`[morning-messages] Failed for user ${profile.id}:`, result.error);
        errorCount++;
      }
    } catch (err) {
      console.error(`[morning-messages] Error sending to user ${profile.id}:`, err);
      errorCount++;
    }

    await new Promise(r => setTimeout(r, 100));
  }

  return NextResponse.json({
    sent: sentCount,
    errors: errorCount,
    total: enrollments.length,
  });
}
