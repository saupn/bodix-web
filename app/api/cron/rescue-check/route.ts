import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendMessage } from '@/lib/messaging';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Lấy enrollments active + profile
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
    .eq('status', 'active');

  if (enrollError || !enrollments || enrollments.length === 0) {
    return NextResponse.json({ rescued: 0 });
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  let rescueCount = 0;

  for (const row of enrollments) {
    const enrollment = row as {
      id: string;
      current_day: number;
      user_id: string;
      program_id: string;
      profiles: { id: string; full_name: string | null; channel_user_id: string | null; preferred_channel: string | null } | { id: string; full_name: string | null; channel_user_id: string | null; preferred_channel: string | null }[];
    };

    const profile = Array.isArray(enrollment.profiles) ? enrollment.profiles[0] : enrollment.profiles;
    const channelUserId = profile?.channel_user_id;
    const channel = (profile?.preferred_channel as 'zalo' | 'whatsapp') || 'zalo';

    if (!channelUserId) continue;

    // Tìm check-in gần nhất (theo workout_date)
    const { data: lastCheckin } = await supabase
      .from('daily_checkins')
      .select('day_number, workout_date')
      .eq('enrollment_id', enrollment.id)
      .order('workout_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lastCheckin) continue; // Chưa check-in lần nào → bỏ qua

    const lastCheckinDate = new Date(lastCheckin.workout_date + 'T00:00:00Z');
    const now = new Date();
    const daysMissed = Math.floor((now.getTime() - lastCheckinDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysMissed < 2) continue;

    // Đã rescue hôm nay chưa?
    const { data: existingRescue } = await supabase
      .from('rescue_interventions')
      .select('id')
      .eq('enrollment_id', enrollment.id)
      .gte('created_at', todayStart.toISOString())
      .limit(1);

    if (existingRescue && existingRescue.length > 0) continue;

    const triggerReason = daysMissed === 2 ? 'missed_2_days' : 'missed_3_plus_days';
    const actionTaken = daysMissed <= 3 ? 'send_rescue_message' : 'coach_intervention';
    const displayName = profile.full_name || 'Bạn';
    const lastCheckedDay = lastCheckin.day_number;

    const rescueMessages: Record<string, string> = {
      missed_2_days:
        `${displayName} ơi, mình thấy bạn chưa check-in 2 ngày rồi.\n` +
        `Chỉ cần 1 lượt Easy (~12 phút) là streak vẫn giữ.\n` +
        `Reply EASY khi xong nhé!`,
      missed_3_plus_days:
        `${displayName} ơi, bạn đã đi được ${lastCheckedDay} ngày rồi.\n` +
        `Mình có thể chuyển bạn sang Easy Mode — chỉ 1 lượt, ~12 phút.\n` +
        `Vẫn tính hoàn thành, streak vẫn giữ!\n` +
        `Reply EASY nếu bạn muốn tiếp tục nhé!`,
    };

    const messageText = rescueMessages[triggerReason] ?? rescueMessages.missed_3_plus_days;

    // Ghi rescue_interventions
    await supabase.from('rescue_interventions').insert({
      enrollment_id: enrollment.id,
      user_id: enrollment.user_id,
      trigger_reason: triggerReason,
      action_taken: actionTaken,
      message_sent: messageText,
      outcome: 'pending',
    });

    // Gửi tin (chỉ khi action_taken = send_rescue_message)
    if (actionTaken === 'send_rescue_message' && channelUserId) {
      await sendMessage({
        userId: profile.id,
        channel,
        channelUserId,
        text: messageText,
      });
    }

    rescueCount++;
    await new Promise(r => setTimeout(r, 100));
  }

  return NextResponse.json({ rescued: rescueCount });
}
