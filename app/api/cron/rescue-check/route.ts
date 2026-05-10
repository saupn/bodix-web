import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sendViaZalo } from '@/lib/messaging/adapters/zalo';
import { insertSupportSystemMessage } from '@/lib/messaging/chat-mirror';
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
    `Chỉ cần 1 lượt – 7 phút – chuỗi ngày tập vẫn giữ.\n` +
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

  if (enrollError) {
    console.error('[rescue-check] enrollments query error:', enrollError);
  }

  const today = new Date().toISOString().split('T')[0];
  const todayStart = new Date(today + 'T00:00:00.000Z').toISOString();
  const stats = {
    l1: 0,
    l2: 0,
    l3_buddy: 0,
    l3_no_buddy: 0,
    skipped: 0,
    errors: 0,
    trial_expired: 0,
    evening_sent: 0,
    evening_skipped: 0,
    evening_errors: 0,
    pre_cohort_sent: 0,
    pre_cohort_skipped: 0,
    pre_cohort_errors: 0,
  };

  for (const row of enrollments ?? []) {
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

        if (result.success) {
          stats.l1++;
          await insertSupportSystemMessage(
            supabase,
            profile.id,
            `Mình thấy bạn chưa tập 2 ngày rồi 💚\nChỉ cần 1 lượt (~7 phút). Mở app tập ngay!`,
          );
        } else {
          stats.errors++;
        }

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
              body: `Bạn đã đi được ${completedDays} ngày – chỉ 1 lượt là quay lại ngay!`,
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

        if (result.success) {
          stats.l2++;
          await insertSupportSystemMessage(
            supabase,
            profile.id,
            `${displayName} ơi, mình nhớ bạn 💚\nBạn đã đi được ${completedDays} ngày – chỉ 1 lượt là quay lại ngay!`,
          );
        } else {
          stats.errors++;
        }

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
                body: `${userFullName} đã nghỉ ${daysMissed} ngày – nhắn hoặc gọi cho bạn ấy nha 🙏`,
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

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TRIAL EXPIRATION CHECK
  // Webhook KHÔNG còn auto-chuyển trial → trial_completed (tránh tin gửi 2 lần khi Zalo retry).
  // Cron này chuyển status + gửi tin "🎯 3 ngày tập thử hoàn thành" đúng 1 lần (qua nudge_logs).
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const { data: trialEnrollments, error: trialError } = await supabase
    .from('enrollments')
    .select('id, user_id, current_day')
    .eq('status', 'trial')
    .gte('current_day', 3);

  if (trialError) {
    console.error('[rescue-check] trial query error:', trialError);
  }

  for (const trialEnrollment of trialEnrollments ?? []) {
    try {
      // Chuyển status thầm lặng
      await supabase
        .from('enrollments')
        .update({ status: 'trial_completed' })
        .eq('id', trialEnrollment.id);

      // Gửi tin Zalo — chỉ 1 lần, dùng nudge_logs làm dedup
      const { data: trialProfile } = await supabase
        .from('profiles')
        .select('channel_user_id, full_name')
        .eq('id', trialEnrollment.user_id)
        .single();

      if (!trialProfile?.channel_user_id) {
        stats.trial_expired++;
        continue;
      }

      const { data: alreadySent } = await supabase
        .from('nudge_logs')
        .select('id')
        .eq('user_id', trialEnrollment.user_id)
        .eq('nudge_type', 'trial_completed')
        .maybeSingle();

      if (alreadySent) {
        stats.trial_expired++;
        continue;
      }

      const trialDisplayName =
        trialProfile.full_name?.split(' ').pop() || trialProfile.full_name || 'Bạn';

      const result = await sendViaZalo(
        trialProfile.channel_user_id,
        `🎯 ${trialDisplayName} ơi, 3 ngày tập thử hoàn thành!\n\nĐăng ký tập chính thức tại bodix.fit/app và chờ thông báo nếu bạn được chọn tham gia nhé!`,
      );

      await supabase.from('nudge_logs').insert({
        user_id: trialEnrollment.user_id,
        enrollment_id: trialEnrollment.id,
        nudge_type: 'trial_completed',
        channel: 'zalo',
        delivered: result.success,
      });

      stats.trial_expired++;
    } catch (err) {
      console.error(`[rescue-check] trial expiration error for enrollment ${trialEnrollment.id}:`, err);
      stats.errors++;
    }

    await new Promise(r => setTimeout(r, 100));
  }

  console.log('[rescue-check] trial expired:', stats.trial_expired);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // EVENING REMINDER (21:00 VN)
  // Gửi cho user trial/active CHƯA check-in hôm nay.
  // Dedup qua nudge_logs (nudge_type='evening_reminder', cùng ngày).
  // Tách riêng với edge function evening-confirmation (chưa schedule) bằng
  // nudge_type khác.
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const { data: eveningEnrollments } = await supabase
    .from('enrollments')
    .select(`
      id,
      user_id,
      current_day,
      status,
      profiles!inner (
        id,
        full_name,
        channel_user_id,
        fcm_token,
        notification_via
      )
    `)
    .in('status', ['trial', 'active']);

  for (const row of eveningEnrollments ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enrollment = row as any;
    const profile = Array.isArray(enrollment.profiles) ? enrollment.profiles[0] : enrollment.profiles;
    const channelUserId: string | null = profile?.channel_user_id;

    // Spec: gửi qua Zalo OA freeform — bỏ qua user không có Zalo connected.
    if (!channelUserId) {
      stats.evening_skipped++;
      continue;
    }

    // Skip nếu đã check-in hôm nay
    const { data: todayCheckin } = await supabase
      .from('daily_checkins')
      .select('id')
      .eq('enrollment_id', enrollment.id)
      .eq('workout_date', today)
      .maybeSingle();

    if (todayCheckin) {
      stats.evening_skipped++;
      continue;
    }

    // Dedup: đã gửi evening_reminder hôm nay chưa
    const { data: alreadySent } = await supabase
      .from('nudge_logs')
      .select('id')
      .eq('user_id', enrollment.user_id)
      .eq('nudge_type', 'evening_reminder')
      .gte('sent_at', todayStart)
      .maybeSingle();

    if (alreadySent) {
      stats.evening_skipped++;
      continue;
    }

    const displayName = profile.full_name?.split(' ').pop() || profile.full_name || 'Bạn';
    const messageText =
      `${displayName} ơi, hôm nay bạn chưa tập 🌙\n` +
      `Còn vài giờ trong ngày – tập 1 lượt (7 phút) cũng đã giữ được chuỗi rồi.\n` +
      `Reply 1, 2 hoặc 3 sau khi tập xong nhé!`;

    try {
      const result = await sendViaZalo(channelUserId, messageText);

      await supabase.from('nudge_logs').insert({
        user_id: enrollment.user_id,
        enrollment_id: enrollment.id,
        nudge_type: 'evening_reminder',
        channel: 'zalo',
        content_template: 'evening_reminder_v1',
        content_variables: { day_number: enrollment.current_day },
        delivered: result.success,
      });

      if (result.success) stats.evening_sent++;
      else stats.evening_errors++;
    } catch (err) {
      console.error(`[rescue-check] evening reminder error for ${enrollment.user_id}:`, err);
      stats.evening_errors++;
    }

    await new Promise(r => setTimeout(r, 100));
  }

  console.log('[rescue-check] evening sent:', stats.evening_sent, 'skipped:', stats.evening_skipped);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PRE-COHORT MESSAGES (4 / 3 / 2 / 1 ngày trước cohort start)
  // Cho user paid_waiting_cohort đã được gán cohort_id.
  // Dedup qua nudge_logs (nudge_type='pre_cohort_d{N}').
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const PRE_COHORT_VARIANTS: { daysBefore: number; type: string; build: (name: string) => string }[] = [
    {
      daysBefore: 4,
      type: 'pre_cohort_d4',
      build: (name) =>
        `${name} ơi, còn 4 ngày nữa đợt tập của bạn bắt đầu! 🌸\n\n` +
        `Hôm nay bạn có thể chuẩn bị: chọn 1 góc nhỏ ở nhà để tập (chỉ cần 2x2m), tìm 1 cái thảm hoặc khăn dày. Vậy là đủ.`,
    },
    {
      daysBefore: 3,
      type: 'pre_cohort_d3',
      build: (name) =>
        `${name} ơi, 3 ngày nữa thôi! 💪\n\n` +
        `Nhỏ thôi: tối nay đặt báo thức tập trước giờ thường ngủ 1 tiếng. Cơ thể quen lịch dần.`,
    },
    {
      daysBefore: 2,
      type: 'pre_cohort_d2',
      build: (name) =>
        `${name} ơi, mai là chuẩn bị – ngày kia bắt đầu! 🎯\n\n` +
        `Một mẹo: đêm nay ngủ sớm 30 phút. Sáng mai dậy đỡ mệt.`,
    },
    {
      daysBefore: 1,
      type: 'pre_cohort_d1',
      build: (name) =>
        `${name} ơi, MAI bắt đầu đợt tập! 🚀\n\n` +
        `Sáng mai 6:30 bạn sẽ nhận tin nhắc tập đầu tiên qua Zalo. Tập 10-20 phút thôi – không áp lực. Mình tin bạn làm được! 💪`,
    },
  ];

  const todayDateForCohort = new Date(today + 'T00:00:00Z');

  for (const variant of PRE_COHORT_VARIANTS) {
    const targetDate = new Date(todayDateForCohort);
    targetDate.setUTCDate(todayDateForCohort.getUTCDate() + variant.daysBefore);
    const targetDateStr = targetDate.toISOString().split('T')[0];

    const { data: cohorts } = await supabase
      .from('cohorts')
      .select('id, name, start_date')
      .eq('status', 'upcoming')
      .eq('start_date', targetDateStr);

    if (!cohorts || cohorts.length === 0) continue;

    for (const cohort of cohorts) {
      const { data: cohortEnrollments } = await supabase
        .from('enrollments')
        .select(`
          id,
          user_id,
          profiles!inner (
            id,
            full_name,
            channel_user_id
          )
        `)
        .eq('cohort_id', cohort.id)
        .eq('status', 'paid_waiting_cohort');

      for (const row of cohortEnrollments ?? []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const enrollment = row as any;
        const profile = Array.isArray(enrollment.profiles) ? enrollment.profiles[0] : enrollment.profiles;
        const channelUserId: string | null = profile?.channel_user_id;

        if (!channelUserId) {
          stats.pre_cohort_skipped++;
          continue;
        }

        // Dedup: đã gửi variant này cho user này chưa (any time)
        const { data: alreadySent } = await supabase
          .from('nudge_logs')
          .select('id')
          .eq('user_id', enrollment.user_id)
          .eq('nudge_type', variant.type)
          .maybeSingle();

        if (alreadySent) {
          stats.pre_cohort_skipped++;
          continue;
        }

        const displayName = profile.full_name?.split(' ').pop() || profile.full_name || 'Bạn';
        const messageText = variant.build(displayName);

        try {
          const result = await sendViaZalo(channelUserId, messageText);

          await supabase.from('nudge_logs').insert({
            user_id: enrollment.user_id,
            enrollment_id: enrollment.id,
            nudge_type: variant.type,
            channel: 'zalo',
            content_template: variant.type,
            content_variables: {
              cohort_id: cohort.id,
              cohort_name: cohort.name,
              start_date: cohort.start_date,
              days_before: variant.daysBefore,
            },
            delivered: result.success,
          });

          if (result.success) stats.pre_cohort_sent++;
          else stats.pre_cohort_errors++;
        } catch (err) {
          console.error(`[rescue-check] pre-cohort ${variant.type} error for ${enrollment.user_id}:`, err);
          stats.pre_cohort_errors++;
        }

        await new Promise(r => setTimeout(r, 100));
      }
    }
  }

  console.log(
    '[rescue-check] pre_cohort sent:', stats.pre_cohort_sent,
    'skipped:', stats.pre_cohort_skipped,
  );

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
