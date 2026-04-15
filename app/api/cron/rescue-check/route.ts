import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sendViaZalo } from '@/lib/messaging/adapters/zalo';
import {
  sendFcmMessage,
  pickMessagingChannel,
} from '@/lib/messaging/adapters/push';
import type { MessageResult } from '@/lib/messaging/types';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RESCUE MESSAGES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildL1Message(name: string): string {
  return (
    `${name} ơi, mình thấy bạn chưa check-in 2 ngày rồi.\n` +
    `Chỉ cần 1 lượt (~7 phút) là chuỗi ngày tập vẫn giữ.\n` +
    `Nhắn 1 khi xong nha!`
  );
}

function buildL2Message(name: string, completedDays: number): string {
  return (
    `${name} ơi, bạn đã đi được ${completedDays} ngày rồi.\n` +
    `Mình hiểu có lúc bận hoặc mệt.\n` +
    `Chỉ cần 1 lượt — 7 phút — chuỗi ngày tập vẫn giữ.\n` +
    `Quan trọng là không dừng lại nha.\n` +
    `Nhắn 1 nếu bạn muốn tiếp tục!`
  );
}

function buildL3BuddyMessage(buddyName: string, userName: string, daysMissed: number): string {
  return (
    `${buddyName} ơi, buddy ${userName} đã nghỉ ${daysMissed} ngày rồi.\n` +
    `Bạn có thể nhắn hoặc gọi cho ${userName} để động viên không?\n` +
    `Đôi khi chỉ cần 1 tin nhắn từ bạn là đủ để quay lại! 🙏`
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

  // Lấy enrollments active + profile
  const { data: enrollments, error: enrollError } = await supabase
    .from('enrollments')
    .select(`
      id,
      current_day,
      user_id,
      program_id,
      cohort_id,
      profiles!inner (
        id,
        full_name,
        channel_user_id,
        fcm_token,
        notification_via
      )
    `)
    .eq('status', 'active');

  if (enrollError || !enrollments || enrollments.length === 0) {
    return NextResponse.json({ l1: 0, l2: 0, l3_buddy: 0, l3_no_buddy: 0 });
  }

  const today = new Date().toISOString().split('T')[0];
  const stats = { l1: 0, l2: 0, l3_buddy: 0, l3_no_buddy: 0, skipped: 0, errors: 0 };

  for (const row of enrollments) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enrollment = row as any;
    const profile = Array.isArray(enrollment.profiles) ? enrollment.profiles[0] : enrollment.profiles;
    const channelUserId: string | null = profile?.channel_user_id;
    const fcmToken: string | null = profile?.fcm_token;

    const userChannel = pickMessagingChannel({
      fcm_token: fcmToken,
      channel_user_id: channelUserId,
      notification_via: profile?.notification_via ?? null,
    });
    if (userChannel === 'none') {
      stats.skipped++;
      continue;
    }

    // Tìm check-in gần nhất
    const { data: lastCheckin } = await supabase
      .from('daily_checkins')
      .select('day_number, workout_date')
      .eq('enrollment_id', enrollment.id)
      .order('workout_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lastCheckin) {
      stats.skipped++;
      continue;
    }

    const lastCheckinDate = new Date(lastCheckin.workout_date + 'T00:00:00Z');
    const todayDate = new Date(today + 'T00:00:00Z');
    const daysMissed = Math.floor((todayDate.getTime() - lastCheckinDate.getTime()) / (1000 * 60 * 60 * 24));

    if (daysMissed < 2) continue;

    // Xác định cấp rescue
    let level: 1 | 2 | 3;
    if (daysMissed === 2) level = 1;
    else if (daysMissed === 3) level = 2;
    else level = 3;

    // Check đã gửi rescue gần đây chưa (trong 7 ngày cho L1, hôm nay cho L2/L3)
    const cooldownDate = level === 1
      ? new Date(todayDate.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      : new Date(todayDate.getTime()).toISOString(); // hôm nay

    const { data: recentRescue } = await supabase
      .from('rescue_interventions')
      .select('id')
      .eq('enrollment_id', enrollment.id)
      .gte('created_at', cooldownDate)
      .limit(1);

    if (recentRescue && recentRescue.length > 0) continue;

    const displayName = profile.full_name?.split(' ').pop() || profile.full_name || 'Bạn';
    const completedDays = lastCheckin.day_number;

    try {
      if (level === 1) {
        // ── CẤP 1: miss 2 ngày → gửi cho user ──
        const zaloMessage = buildL1Message(displayName);
        let result: MessageResult;
        if (userChannel === 'push') {
          result = await sendFcmMessage(
            fcmToken!,
            {
              type: 'rescueDay2',
              title: 'Mình thấy bạn chưa tập 2 ngày rồi',
              body: 'Chỉ cần 1 lượt (~7 phút). Mở app tập ngay!',
              data: { days_missed: String(daysMissed) },
            },
            profile.id,
          );
        } else {
          result = await sendViaZalo(channelUserId!, zaloMessage);
        }

        await supabase.from('rescue_interventions').insert({
          enrollment_id: enrollment.id,
          user_id: enrollment.user_id,
          trigger_reason: 'missed_2_days',
          action_taken: 'send_rescue_message',
          message_sent: userChannel === 'push' ? 'push:rescueDay2' : zaloMessage,
          outcome: 'pending',
        });

        await supabase.from('nudge_logs').insert({
          user_id: profile.id,
          enrollment_id: enrollment.id,
          nudge_type: 'rescue_soft',
          channel: userChannel,
          content_template: 'rescue_l1',
          content_variables: { days_missed: daysMissed },
          delivered: result.success,
        });

        if (result.success) stats.l1++;
        else stats.errors++;

      } else if (level === 2) {
        // ── CẤP 2: miss 3 ngày → gửi cho user ──
        const zaloMessage = buildL2Message(displayName, completedDays);
        let result: MessageResult;
        if (userChannel === 'push') {
          result = await sendFcmMessage(
            fcmToken!,
            {
              type: 'rescueDay3',
              title: `${displayName} ơi, mình nhớ bạn 💚`,
              body: `Bạn đã đi được ${completedDays} ngày — chỉ 1 lượt là quay lại ngay!`,
              data: {
                days_missed: String(daysMissed),
                completed_days: String(completedDays),
              },
            },
            profile.id,
          );
        } else {
          result = await sendViaZalo(channelUserId!, zaloMessage);
        }

        await supabase.from('rescue_interventions').insert({
          enrollment_id: enrollment.id,
          user_id: enrollment.user_id,
          trigger_reason: 'missed_3_plus_days',
          action_taken: 'send_rescue_message',
          message_sent: userChannel === 'push' ? 'push:rescueDay3' : zaloMessage,
          outcome: 'pending',
        });

        await supabase.from('nudge_logs').insert({
          user_id: profile.id,
          enrollment_id: enrollment.id,
          nudge_type: 'rescue_urgent',
          channel: userChannel,
          content_template: 'rescue_l2',
          content_variables: { days_missed: daysMissed, completed_days: completedDays },
          delivered: result.success,
        });

        if (result.success) stats.l2++;
        else stats.errors++;

      } else {
        // ── CẤP 3: miss 4+ ngày → gửi cho buddy ──
        const buddy = await findBuddy(supabase, enrollment.user_id, enrollment.cohort_id);

        const buddyChannel = buddy
          ? pickMessagingChannel({
              fcm_token: buddy.fcm_token,
              channel_user_id: buddy.channel_user_id,
              notification_via: buddy.notification_via,
            })
          : 'none';

        if (buddy && buddyChannel !== 'none') {
          const buddyDisplayName = buddy.full_name?.split(' ').pop() || buddy.full_name || 'Bạn';
          const userFullName = profile.full_name || 'buddy của bạn';
          const zaloMessage = buildL3BuddyMessage(buddyDisplayName, userFullName, daysMissed);

          let result: MessageResult;
          if (buddyChannel === 'push') {
            result = await sendFcmMessage(
              buddy.fcm_token!,
              {
                type: 'system',
                title: `Buddy ${userFullName} cần bạn động viên`,
                body: `${userFullName} đã nghỉ ${daysMissed} ngày — nhắn hoặc gọi cho bạn ấy nha 🙏`,
                data: {
                  days_missed: String(daysMissed),
                  buddy_id: buddy.id,
                },
              },
              buddy.id,
            );
          } else {
            result = await sendViaZalo(buddy.channel_user_id!, zaloMessage);
          }

          await supabase.from('rescue_interventions').insert({
            enrollment_id: enrollment.id,
            user_id: enrollment.user_id,
            trigger_reason: 'missed_3_plus_days',
            action_taken: 'send_rescue_message',
            message_sent: buddyChannel === 'push' ? 'push:buddy_l3' : zaloMessage,
            outcome: 'pending',
          });

          await supabase.from('nudge_logs').insert({
            user_id: profile.id,
            enrollment_id: enrollment.id,
            nudge_type: 'rescue_critical',
            channel: buddyChannel,
            content_template: 'rescue_l3_buddy',
            content_variables: {
              days_missed: daysMissed,
              buddy_id: buddy.id,
              buddy_name: buddy.full_name,
            },
            delivered: result.success,
          });

          if (result.success) stats.l3_buddy++;
          else stats.errors++;

        } else {
          // Không có buddy → log cho admin xử lý thủ công
          await supabase.from('rescue_interventions').insert({
            enrollment_id: enrollment.id,
            user_id: enrollment.user_id,
            trigger_reason: 'missed_3_plus_days',
            action_taken: 'coach_intervention',
            message_sent: null,
            outcome: 'pending',
          });

          await supabase.from('nudge_logs').insert({
            user_id: profile.id,
            enrollment_id: enrollment.id,
            nudge_type: 'rescue_critical',
            channel: 'none',
            content_template: 'rescue_l3_no_buddy',
            content_variables: { days_missed: daysMissed },
            delivered: false,
          });

          stats.l3_no_buddy++;
        }
      }
    } catch (err) {
      console.error(`[rescue-check] Error for user ${profile.id}:`, err);
      stats.errors++;
    }

    await new Promise(r => setTimeout(r, 100));
  }

  return NextResponse.json(stats);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FIND BUDDY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface BuddyProfile {
  id: string;
  full_name: string | null;
  channel_user_id: string | null;
  fcm_token: string | null;
  notification_via: string | null;
}

async function findBuddy(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  cohortId: string | null,
): Promise<BuddyProfile | null> {
  if (!cohortId) return null;

  // Tìm buddy pair: user có thể là user_a hoặc user_b
  const { data: pairA } = await supabase
    .from('buddy_pairs')
    .select('user_b')
    .eq('cohort_id', cohortId)
    .eq('user_a', userId)
    .limit(1)
    .maybeSingle();

  const { data: pairB } = await supabase
    .from('buddy_pairs')
    .select('user_a')
    .eq('cohort_id', cohortId)
    .eq('user_b', userId)
    .limit(1)
    .maybeSingle();

  const buddyId = pairA?.user_b ?? pairB?.user_a ?? null;
  if (!buddyId) return null;

  // Lấy profile buddy — buddy có thể là app user (fcm_token) hoặc web user (channel_user_id)
  const { data: buddyProfile } = await supabase
    .from('profiles')
    .select('id, full_name, channel_user_id, fcm_token, notification_via')
    .eq('id', buddyId)
    .single();

  if (!buddyProfile) return null;
  if (!buddyProfile.channel_user_id && !buddyProfile.fcm_token) return null;

  return buddyProfile as BuddyProfile;
}
