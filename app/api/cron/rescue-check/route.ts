import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sendViaZalo } from '@/lib/messaging/adapters/zalo';
import { insertSupportSystemMessage } from '@/lib/messaging/chat-mirror';
import { sendFcmMessage } from '@/lib/messaging/adapters/push';
import {
  getVietnamDateString,
  getVietnamWeekday,
  isoTimestampToVietnamYmd,
} from '@/lib/date/vietnam';
import { countMissedWorkoutDays } from '@/lib/rescue/escalation';
import { getEligibleForNudge } from '@/lib/notifications/eligible-enrollments';
import { transitionAffiliateCommissions } from '@/lib/affiliate/commission';
import {
  transitionReferralCommissions,
  expireOldVouchers,
} from '@/lib/referral/commission';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EVENING REMINDER (20:00 VN) — Rescue Protocol Level 1 tone
// Triết lý: giữ nhịp, không thúc ép. Gợi ý phiên Easy 10-15 phút để
// "bước lên thảm" — quan trọng là duy trì hành động, không phải hoàn thành.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function buildEveningMessage(name: string): string {
  return (
    `${name} ơi 🌿\n` +
    `Tối nay còn vài giờ – nếu bạn mở thảm ra, dù chỉ 10-15 phút Easy thôi cũng đủ giữ nhịp ngày hôm nay.\n` +
    `\n` +
    `Không cần hoàn hảo – chỉ cần bước lên thảm là đã thắng rồi.\n` +
    `\n` +
    `Tập xong rồi nhắn số lượt cho mình nhé: 3 nếu bạn tập đủ 3 lượt, 2 nếu 2 lượt, 1 nếu 1 lượt. Mình ghi lại cho bạn 💚`
  );
}

function buildEveningPushBody(): string {
  return 'Mở thảm 10-15 phút Easy – bước lên thảm là đã thắng rồi 💚';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SUB-TASK WRAPPER — đảm bảo 1 phần fail không kéo phần khác fail.
// Trả về 'ok' nếu chạy xong (kể cả khi có lỗi nội bộ đã được handle),
// 'error: <msg>' nếu throw không bắt được.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type SubTaskResult = 'ok' | `error: ${string}`;

async function runSubTask(
  name: string,
  fn: () => Promise<void>,
): Promise<SubTaskResult> {
  const t0 = Date.now();
  try {
    await fn();
    console.log(`[rescue-check] ✓ ${name} done in ${Date.now() - t0}ms`);
    return 'ok';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[rescue-check] ✗ ${name} threw:`, msg, err);
    return `error: ${msg}` as SubTaskResult;
  }
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
  const todayVN = getVietnamDateString();
  const todayVNStartUtc = new Date(`${todayVN}T00:00:00+07:00`).toISOString();

  // Housekeeping: dọn magic-link token đã hết hạn (giữ thêm 1 ngày để debug).
  // Token ephemeral (24h) → không cần backup. Lỗi cleanup không chặn rescue.
  {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { error: cleanupError } = await supabase
      .from('workout_access_tokens')
      .delete()
      .lt('expires_at', cutoff);
    if (cleanupError) {
      console.error('[rescue-check] workout_access_tokens cleanup failed:', cleanupError.message);
    }
  }

  const stats = {
    errors: 0,
    trial_expired: 0,
    evening_eligible: 0,
    evening_by_status: { active: 0, trial: 0 },
    evening_by_channel: { fcm: 0, zalo: 0, none: 0 },
    evening_sent: 0,
    evening_skipped_dedup: 0,
    evening_skipped_already_checked_in: 0,
    evening_skipped_rescue: 0,
    evening_skipped_no_channel: 0,
    evening_skipped_not_started: 0,
    evening_errors: 0,
    pre_cohort_sent: 0,
    pre_cohort_skipped: 0,
    pre_cohort_errors: 0,
    orphan_assigned: 0,
    orphan_skipped: 0,
    commission_scanned: 0,
    commission_to_payable: 0,
    commission_cancelled_timeout: 0,
    commission_cancelled_dropped: 0,
    commission_cancelled_no_checkin: 0,
    commission_flagged_suspicious: 0,
    commission_errors: 0,
    referral_commission_scanned: 0,
    referral_commission_to_payable: 0,
    referral_commission_cancelled_timeout: 0,
    referral_commission_cancelled_dropped: 0,
    referral_commission_cancelled_no_checkin: 0,
    referral_commission_errors: 0,
    voucher_expired: 0,
    voucher_expire_errors: 0,
  };

  const subTaskResults: Record<string, SubTaskResult> = {};

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // RESCUE L1/L2/L3 — ĐÃ CHUYỂN sang cron sáng (morning-messages).
  //
  // Tin rescue giờ THAY tin sáng (adaptive) theo missedDays (bỏ CN), bands
  // L1(2)/L2(3–4)/L3(5–7)/dormant(>7) — xem lib/rescue/escalation.ts. Bỏ sub-task
  // rescue buổi tối ở đây để KHÔNG gửi 2 lần/ngày. Buổi tối chỉ còn:
  // evening confirmation (skip nếu user đã nhận rescue sáng / dormant).
  //
  // Genome v1 (dropout_signals + risk_score) vẫn DECOUPLED, chỉ để quan sát.
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SUB-TASK 2: TRIAL COMPLETION
  // Webhook KHÔNG còn auto-chuyển trial → trial_completed (tránh tin gửi 2 lần khi Zalo retry).
  // Cron này chuyển status + gửi tin "🎯 3 ngày tập thử hoàn thành" đúng 1 lần (qua nudge_logs).
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  subTaskResults.trial_completion = await runSubTask('trial_completion', async () => {
    const { data: trialEnrollments, error: trialError } = await supabase
      .from('enrollments')
      .select('id, user_id, current_day')
      .eq('status', 'trial')
      .gte('current_day', 3);

    if (trialError) {
      console.error('[rescue-check] trial query error:', trialError);
      return;
    }

    for (const trialEnrollment of trialEnrollments ?? []) {
      try {
        await supabase
          .from('enrollments')
          .update({ status: 'trial_completed' })
          .eq('id', trialEnrollment.id);

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
          .eq('nudge_type', 'trial_expired')
          .maybeSingle();

        if (alreadySent) {
          stats.trial_expired++;
          continue;
        }

        const trialDisplayName =
          trialProfile.full_name?.split(' ').pop() || trialProfile.full_name || 'Bạn';

        const result = await sendViaZalo(
          trialProfile.channel_user_id,
          `🎯 ${trialDisplayName} ơi, 3 ngày tập thử hoàn thành!\n\nĐăng ký khoá đầy đủ ngay tại bodix.fit/app để tham gia đợt tập gần nhất – có thể thanh toán bất cứ lúc nào nhé!`,
        );

        await supabase.from('nudge_logs').insert({
          user_id: trialEnrollment.user_id,
          enrollment_id: trialEnrollment.id,
          nudge_type: 'trial_expired',
          channel: 'zalo',
          delivered: result.success,
        });

        stats.trial_expired++;
      } catch (err) {
        console.error(
          `[rescue-check] trial expiration error for enrollment ${trialEnrollment.id}:`,
          err,
        );
        stats.errors++;
      }

      await new Promise(r => setTimeout(r, 100));
    }

    console.log('[rescue-check] trial expired:', stats.trial_expired);
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SUB-TASK 3: EVENING REMINDER (20:00 VN)
  // Eligibility chung helper với morning. Tone Rescue Protocol L1: giữ nhịp,
  // không trách móc. Dedup qua nudge_logs (nudge_type='evening_confirmation',
  // cùng ngày VN). Dual-channel: hasApp → FCM, !hasApp → Zalo.
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  subTaskResults.evening_reminder = await runSubTask('evening_reminder', async () => {
    const { enrollments: eligible, breakdown } = await getEligibleForNudge(
      'evening',
      todayVN,
    );

    stats.evening_eligible = breakdown.total;
    stats.evening_by_status = breakdown.by_status;
    stats.evening_by_channel = breakdown.by_channel;

    console.log(
      '[rescue-check] evening eligibility:',
      JSON.stringify({
        todayVN,
        total: breakdown.total,
        by_status: breakdown.by_status,
        by_channel: breakdown.by_channel,
        trial_expired_filtered: breakdown.trial_expired_filtered,
      }),
    );

    for (const en of eligible) {
      const profile = en.profile;
      const channelUserId = profile.channel_user_id;
      const fcmToken = profile.fcm_token;

      // Defensive: nếu started_at vẫn nằm sau hôm nay VN thì skip — phòng
      // race với enrollment vừa tạo trong giờ tiếp theo. NULL started_at
      // (trial chưa POST /api/trial/start) cũng skip — chưa thực sự bắt đầu.
      if (!en.started_at) {
        stats.evening_skipped_not_started++;
        continue;
      }
      const startedYmdVN = isoTimestampToVietnamYmd(en.started_at);
      if (startedYmdVN > todayVN) {
        console.log(
          '[rescue-check] evening skip not-started-yet user:',
          en.user_id,
          'started_at:',
          en.started_at,
        );
        stats.evening_skipped_not_started++;
        continue;
      }

      if (!channelUserId && !fcmToken) {
        stats.evening_skipped_no_channel++;
        continue;
      }

      // Skip nếu đã check-in hôm nay (program check-in → daily_checkins).
      const { data: todayCheckin } = await supabase
        .from('daily_checkins')
        .select('id')
        .eq('enrollment_id', en.enrollment_id)
        .eq('workout_date', todayVN)
        .maybeSingle();

      if (todayCheckin) {
        stats.evening_skipped_already_checked_in++;
        continue;
      }

      // Trial-bucket: check-in được ghi vào trial_activities (KHÔNG daily_checkins).
      // Nếu chỉ xét daily_checkins, user trial đã tập sáng vẫn nhận tin tối → spam.
      // Mọi complete_trial_day tạo trong ngày VN hôm nay (created_at >= đầu ngày VN
      // theo UTC) tính là đã check-in → skip evening.
      if (en.status === 'trial') {
        const { data: trialCheckinToday } = await supabase
          .from('trial_activities')
          .select('id')
          .eq('user_id', en.user_id)
          .eq('activity_type', 'complete_trial_day')
          .gte('created_at', todayVNStartUtc)
          .limit(1)
          .maybeSingle();

        if (trialCheckinToday) {
          stats.evening_skipped_already_checked_in++;
          continue;
        }
      }

      // Chủ nhật (lịch VN) = ngày Review, active KHÔNG có buổi tập → không hỏi
      // "đã tập chưa". (rescue-check là sender chính buổi tối, chạy trước edge fn.)
      if (en.status === 'active' && getVietnamWeekday(todayVN) === 0) {
        stats.evening_skipped_rescue++;
        continue;
      }

      // Active đang lỡ nhịp (missedDays >= 2) → sáng nay đã nhận tin Rescue THAY tin tập
      // (hoặc dormant >7). KHÔNG nhắc tối lần nữa (tránh 2 tin/ngày). missedDays tính
      // theo ngày tập (bỏ CN), đến hôm qua — cùng logic với cron sáng.
      if (en.status === 'active') {
        const startAnchor =
          en.cohort_start_date ?? isoTimestampToVietnamYmd(en.enrolled_at);
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
        if (missedDays >= 2) {
          stats.evening_skipped_rescue++;
          continue;
        }
      }

      // Dedup: đã gửi evening_confirmation hôm nay chưa (key: enrollment + ngày VN)
      const { data: alreadySent } = await supabase
        .from('nudge_logs')
        .select('id')
        .eq('enrollment_id', en.enrollment_id)
        .eq('nudge_type', 'evening_confirmation')
        .gte('sent_at', todayVNStartUtc)
        .maybeSingle();

      if (alreadySent) {
        stats.evening_skipped_dedup++;
        continue;
      }

      const displayName =
        profile.full_name?.split(' ').pop() || profile.full_name || 'Bạn';
      const zaloMessage = buildEveningMessage(displayName);
      const pushBody = buildEveningPushBody();
      const pushTitle = `${displayName} ơi, còn vài giờ trong ngày 💚`;

      const logVars = {
        day_number: en.current_day,
        status: en.status,
      };

      // Dual-channel: hasApp → FCM (ưu tiên), !hasApp → Zalo
      let sent = false;
      let lastError: string | null = null;

      if (en.hasApp && fcmToken) {
        try {
          const result = await sendFcmMessage(
            fcmToken,
            {
              type: 'eveningReminder',
              title: pushTitle,
              body: pushBody,
              data: {
                day_number: String(en.current_day),
                status: en.status,
              },
            },
            en.user_id,
          );

          if (result.success) {
            sent = true;
            await supabase.from('nudge_logs').insert({
              user_id: en.user_id,
              enrollment_id: en.enrollment_id,
              nudge_type: 'evening_confirmation',
              channel: 'push',
              content_template: 'evening_rescue_l1',
              content_variables: logVars,
              delivered: true,
            });
            await insertSupportSystemMessage(supabase, en.user_id, zaloMessage);
          } else {
            lastError = result.error ?? 'fcm_unknown';
          }
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
        }
      }

      // Fallback Zalo nếu chưa gửi được qua FCM
      if (!sent && channelUserId) {
        try {
          const result = await sendViaZalo(channelUserId, zaloMessage);

          await supabase.from('nudge_logs').insert({
            user_id: en.user_id,
            enrollment_id: en.enrollment_id,
            nudge_type: 'evening_confirmation',
            channel: 'zalo',
            content_template: 'evening_rescue_l1',
            content_variables: logVars,
            delivered: result.success,
          });

          if (result.success) {
            sent = true;
          } else {
            lastError = result.error ?? 'zalo_unknown';
          }
        } catch (err) {
          lastError = err instanceof Error ? err.message : String(err);
        }
      }

      if (sent) {
        stats.evening_sent++;
      } else {
        stats.evening_errors++;
        console.error(
          `[rescue-check] evening reminder failed for ${en.user_id}: ${lastError ?? 'no channel'}`,
        );
      }

      await new Promise(r => setTimeout(r, 100));
    }

    console.log(
      '[rescue-check] evening sent:', stats.evening_sent,
      'dedup:', stats.evening_skipped_dedup,
      'already_checked_in:', stats.evening_skipped_already_checked_in,
      'no_channel:', stats.evening_skipped_no_channel,
      'errors:', stats.evening_errors,
    );
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SUB-TASK 4: PRE-COHORT MESSAGES (4 / 3 / 2 / 1 ngày trước cohort start)
  // Cho user paid_waiting_cohort đã được gán cohort_id.
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  subTaskResults.pre_cohort = await runSubTask('pre_cohort', async () => {
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

    const todayDateForCohort = new Date(todayVN + 'T00:00:00Z');

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

          // Dedup: NOTE — nudge_type 'pre_cohort_d{N}' chưa nằm trong CHECK constraint
          // của nudge_logs (migration 009). Insert sẽ fail silently → dedup không hoạt động.
          // Pre-existing bug, không trong scope sửa lần này.
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
            console.error(
              `[rescue-check] pre-cohort ${variant.type} error for ${enrollment.user_id}:`,
              err,
            );
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
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SUB-TASK 5: AUTO-ASSIGN ORPHAN PAID USERS
  // User đã thanh toán nhưng cohort_id = null. Cron tìm cohort upcoming còn chỗ và gán.
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  subTaskResults.orphan_assign = await runSubTask('orphan_assign', async () => {
    const { data: orphanEnrollments } = await supabase
      .from('enrollments')
      .select('id, user_id, program_id')
      .eq('status', 'paid_waiting_cohort')
      .is('cohort_id', null);

    for (const orphan of orphanEnrollments ?? []) {
      if (!orphan.program_id) {
        stats.orphan_skipped++;
        continue;
      }

      const { data: nextCohort } = await supabase
        .from('cohorts')
        .select('id, name, start_date, max_members, current_members')
        .eq('program_id', orphan.program_id)
        .eq('status', 'upcoming')
        .gte('start_date', todayVN)
        .order('start_date', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!nextCohort) {
        stats.orphan_skipped++;
        continue;
      }

      const max = nextCohort.max_members ?? 50;
      const current = nextCohort.current_members ?? 0;
      if (current >= max) {
        stats.orphan_skipped++;
        continue;
      }

      const { error: assignErr } = await supabase
        .from('enrollments')
        .update({ cohort_id: nextCohort.id })
        .eq('id', orphan.id);

      if (assignErr) {
        console.error('[rescue-check] orphan assign error:', orphan.user_id, assignErr);
        continue;
      }

      await supabase
        .from('cohorts')
        .update({ current_members: current + 1 })
        .eq('id', nextCohort.id);

      stats.orphan_assigned++;
      console.log(
        '[rescue-check] auto-assigned orphan user:',
        orphan.user_id,
        'to',
        nextCohort.name,
      );
    }

    console.log(
      '[rescue-check] orphan assigned:', stats.orphan_assigned,
      'skipped:', stats.orphan_skipped,
    );
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SUB-TASK 6: AFFILIATE COMMISSION PROCESSING (V2 cooldown)
  // Promote pending → payable khi referee active + check-in.
  // Cancel khi timeout / dropped / no_checkin > 14 ngày sau active.
  // Flag suspicious khi > 10 conversion / 7 ngày.
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  subTaskResults.commission_processing = await runSubTask('commission_processing', async () => {
    const result = await transitionAffiliateCommissions(supabase);
    stats.commission_scanned = result.scanned;
    stats.commission_to_payable = result.to_payable;
    stats.commission_cancelled_timeout = result.to_cancelled_timeout;
    stats.commission_cancelled_dropped = result.to_cancelled_dropped;
    stats.commission_cancelled_no_checkin = result.to_cancelled_no_checkin;
    stats.commission_flagged_suspicious = result.flagged_suspicious;
    stats.commission_errors = result.errors;
    console.log('[rescue-check] commission:', JSON.stringify(result));
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SUB-TASK 7: REFERRAL COMMISSION PROCESSING (BD-REFERRAL-VOUCHER-FLOW)
  // Promote pending → payable + tạo voucher 100K cho beneficiary (idempotent).
  // Cùng cooldown (60d timeout / 14d no-checkin) như affiliate, KHÔNG suspicious.
  // Wrap riêng — fail không ảnh hưởng affiliate processing.
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  subTaskResults.referral_commission_processing = await runSubTask(
    'referral_commission_processing',
    async () => {
      const result = await transitionReferralCommissions(supabase);
      stats.referral_commission_scanned = result.scanned;
      stats.referral_commission_to_payable = result.to_payable;
      stats.referral_commission_cancelled_timeout = result.to_cancelled_timeout;
      stats.referral_commission_cancelled_dropped = result.to_cancelled_dropped;
      stats.referral_commission_cancelled_no_checkin = result.to_cancelled_no_checkin;
      stats.referral_commission_errors = result.errors;
      console.log('[rescue-check] referral_commission:', JSON.stringify(result));
    },
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SUB-TASK 8: VOUCHER EXPIRY (BD-REFERRAL-VOUCHER-FLOW)
  // active → expired khi expires_at < now. Mỗi voucher 90 ngày sau khi tạo.
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  subTaskResults.voucher_expire = await runSubTask('voucher_expire', async () => {
    const result = await expireOldVouchers(supabase);
    stats.voucher_expired = result.expired;
    stats.voucher_expire_errors = result.errors;
    console.log('[rescue-check] voucher_expire:', JSON.stringify(result));
  });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // SUMMARY
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const summary = {
    cron: 'rescue-check',
    timing_part: 'evening',
    todayVN,
    sub_task_results: subTaskResults,
    ...stats,
  };

  console.log('[rescue-check] summary:', JSON.stringify(summary));

  return NextResponse.json(summary);
}
