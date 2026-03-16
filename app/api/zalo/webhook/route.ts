import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const service = createServiceClient();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET — Zalo dùng để verify webhook
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function GET() {
  return NextResponse.json({ status: 'ok' }, { status: 200 });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST — Zalo webhook events
// Trả 200 ngay để Zalo không retry; xử lý logic sau khi parse payload.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    // Verify nhanh — vẫn trả 200 để Zalo không retry
    if (payload.app_id !== process.env.ZALO_APP_ID) {
      console.error('Invalid app_id:', payload.app_id);
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // Xử lý theo loại sự kiện (không có query Supabase trước đây)
    switch (payload.event_name) {
      case 'user_send_text':
        await handleUserMessage(payload);
        break;
      case 'follow':
        await handleFollow(payload);
        break;
      case 'unfollow':
        await handleUnfollow(payload);
        break;
      default:
        console.log('Unhandled event:', payload.event_name);
    }

    // Trả 200 ngay — Zalo chờ max 2 giây
    return NextResponse.json({ ok: true }, { status: 200 });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ ok: true }, { status: 200 }); // Vẫn trả 200 để Zalo không retry
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PARSE TIN NHẮN CHECK-IN
// Hard (3 lượt) / Light (2 lượt) / Easy (1 lượt)
// Cả 3 đều = Done → streak +1
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function parseCheckinType(text: string): 'hard' | 'light' | 'easy' | null {
  const t = text.trim().toUpperCase();

  const hard = ['HARD', 'H', '3', 'FULL', 'DONE', 'XONG', '✅', 'DA TAP'];
  const light = ['LIGHT', 'L', '2', 'NHE'];
  const easy = ['EASY', 'E', '1', 'DE', 'OK'];

  if (hard.some(k => t === k || t.startsWith(k + ' '))) return 'hard';
  if (light.some(k => t === k || t.startsWith(k + ' '))) return 'light';
  if (easy.some(k => t === k || t.startsWith(k + ' '))) return 'easy';

  if (hard.some(k => t.includes(k))) return 'hard';
  if (light.some(k => t.includes(k))) return 'light';
  if (easy.some(k => t.includes(k))) return 'easy';

  return null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// XỬ LÝ CHECK-IN
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function handleUserMessage(payload: { sender: { id: string }; message: { text?: string } }) {
  const zaloUserId = payload.sender.id;
  const messageText = payload.message.text || '';
  const checkinType = parseCheckinType(messageText);

  if (!checkinType) {
    await sendZaloMessage(zaloUserId,
      'Mình chưa hiểu. Reply:\n' +
      '• HARD hoặc 3 → tập đủ 3 lượt\n' +
      '• LIGHT hoặc 2 → tập 2 lượt\n' +
      '• EASY hoặc 1 → tập 1 lượt\n' +
      'Cả 3 đều tính hoàn thành!'
    );
    return;
  }

  // 1. Tìm profile theo channel_user_id (Zalo UID)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('channel_user_id', zaloUserId)
    .single();

  if (profileError || !profile) {
    await sendZaloMessage(zaloUserId,
      'Mình chưa tìm thấy tài khoản của bạn. Vui lòng đăng ký tại bodix.fit trước nhé!'
    );
    return;
  }

  // 2. Tìm enrollment active
  const { data: enrollment, error: enrollmentError } = await supabase
    .from('enrollments')
    .select('id, user_id, cohort_id, current_day, program_id, programs(duration_days)')
    .eq('user_id', profile.id)
    .eq('status', 'active')
    .single();

  if (enrollmentError || !enrollment) {
    await sendZaloMessage(zaloUserId,
      'Bạn chưa đăng ký chương trình. Vui lòng đăng ký tại bodix.fit nhé!'
    );
    return;
  }

  const programDays = (enrollment.programs as { duration_days: number } | null)?.duration_days ?? 21;
  const dayNumber = (enrollment.current_day ?? 0) + 1;

  if (dayNumber > programDays) {
    await sendZaloMessage(zaloUserId,
      'Bạn đã hoàn thành chương trình rồi! Chúc mừng! 🏆'
    );
    return;
  }

  // 3. Kiểm tra đã check-in ngày này chưa
  const { data: existing } = await supabase
    .from('daily_checkins')
    .select('id')
    .eq('enrollment_id', enrollment.id)
    .eq('day_number', dayNumber)
    .limit(1);

  if (existing && existing.length > 0) {
    await sendZaloMessage(zaloUserId,
      `Bạn đã check-in ngày ${dayNumber} rồi! Nghỉ ngơi và hẹn ngày mai nhé 💪`
    );
    return;
  }

  const workoutDate = new Date().toISOString().split('T')[0];

  // 4. Ghi check-in
  const { error: checkinError } = await service
    .from('daily_checkins')
    .insert({
      enrollment_id: enrollment.id,
      user_id: profile.id,
      cohort_id: enrollment.cohort_id ?? null,
      day_number: dayNumber,
      workout_date: workoutDate,
      mode: checkinType,
      completed_at: new Date().toISOString(),
    });

  if (checkinError) {
    if (checkinError.code === '23505') {
      await sendZaloMessage(zaloUserId,
        `Bạn đã check-in ngày ${dayNumber} rồi! Nghỉ ngơi và hẹn ngày mai nhé 💪`
      );
      return;
    }
    console.error('[zalo/webhook] insert daily_checkins:', checkinError);
    await sendZaloMessage(zaloUserId, 'Có lỗi xảy ra. Vui lòng thử lại sau.');
    return;
  }

  // 5. Cập nhật streak (giống checkin API)
  const { data: existingStreak } = await service
    .from('streaks')
    .select('*')
    .eq('enrollment_id', enrollment.id)
    .maybeSingle();

  const prev = existingStreak ?? {
    current_streak: 0,
    longest_streak: 0,
    total_completed_days: 0,
    total_hard_days: 0,
    total_light_days: 0,
    total_recovery_days: 0,
    total_easy_days: 0,
    total_skip_days: 0,
    last_checkin_date: null,
    streak_started_at: null,
  };

  const prevDayStr = shiftDate(workoutDate, -1);
  const prevLastCheckin = prev.last_checkin_date ?? null;

  let newCurrentStreak = prev.current_streak;
  let newStreakStartedAt = prev.streak_started_at;

  if (prevLastCheckin === null) {
    newCurrentStreak = 1;
    newStreakStartedAt = workoutDate;
  } else if (prevLastCheckin === prevDayStr) {
    newCurrentStreak = prev.current_streak + 1;
  } else {
    newCurrentStreak = 1;
    newStreakStartedAt = workoutDate;
  }

  const newLongestStreak = Math.max(newCurrentStreak, prev.longest_streak);

  const streakUpsert = {
    enrollment_id: enrollment.id,
    user_id: profile.id,
    current_streak: newCurrentStreak,
    longest_streak: newLongestStreak,
    total_completed_days: prev.total_completed_days + 1,
    total_hard_days: checkinType === 'hard' ? prev.total_hard_days + 1 : prev.total_hard_days,
    total_light_days: checkinType === 'light' ? prev.total_light_days + 1 : prev.total_light_days,
    total_recovery_days: checkinType === 'recovery' ? prev.total_recovery_days + 1 : prev.total_recovery_days,
    total_easy_days: checkinType === 'easy' ? (prev.total_easy_days ?? 0) + 1 : (prev.total_easy_days ?? 0),
    total_skip_days: prev.total_skip_days,
    last_checkin_date: workoutDate,
    streak_started_at: newStreakStartedAt,
    updated_at: new Date().toISOString(),
  };

  await service
    .from('streaks')
    .upsert(streakUpsert, { onConflict: 'enrollment_id' });

  // 6. Cập nhật enrollment
  const isComplete = dayNumber >= programDays;
  await service
    .from('enrollments')
    .update({
      current_day: dayNumber,
      ...(isComplete ? { status: 'completed', completed_at: new Date().toISOString() } : {}),
    })
    .eq('id', enrollment.id);

  // 7. Phản hồi
  const emojis: Record<string, string> = { hard: '🔥', light: '💪', easy: '✅' };
  const labels: Record<string, string> = { hard: '3 lượt', light: '2 lượt', easy: '1 lượt' };
  const displayName = profile.full_name || 'Bạn';

  await sendZaloMessage(zaloUserId,
    `${emojis[checkinType]} Ngày ${dayNumber}/${programDays} hoàn thành (${labels[checkinType]})! Streak: ${newCurrentStreak} ngày`
  );

  if (isComplete) {
    const totalDone = streakUpsert.total_completed_days;
    const totalHard = streakUpsert.total_hard_days;
    const totalLight = streakUpsert.total_light_days;
    const totalEasy = streakUpsert.total_easy_days;
    const totalRecovery = streakUpsert.total_recovery_days;
    await sendZaloMessage(zaloUserId,
      `🏆 CHÚC MỪNG ${displayName}! Bạn đã hoàn thành BodiX 21!\n` +
      `Tổng ${totalDone} buổi: ${totalHard} Hard + ${totalLight} Light + ${totalEasy} Easy + ${totalRecovery} Recovery\n` +
      `Bạn là người hoàn thành. Tự hào về bản thân!`
    );
  }
}

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FOLLOW / UNFOLLOW
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function handleFollow(payload: { follower?: { id: string }; user_id_by_app?: string }) {
  const zaloUserId = payload.follower?.id || payload.user_id_by_app;
  if (!zaloUserId) return;

  console.log('New follower:', zaloUserId);

  // Cập nhật profile nếu đã có (match channel_user_id)
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('channel_user_id', zaloUserId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from('profiles')
      .update({
        channel_user_id: zaloUserId,
        preferred_channel: 'zalo',
      })
      .eq('id', existing.id);
  }

  await sendZaloMessage(zaloUserId,
    'Chào mừng bạn đến với BodiX! 💪\n\n' +
    'Để bắt đầu hành trình 21 ngày, đăng ký tại bodix.fit nhé.\n' +
    'Sau khi đăng ký, bạn sẽ nhận tin nhắc tập mỗi sáng 6:30.'
  );
}

async function handleUnfollow(payload: { follower?: { id: string }; user_id_by_app?: string }) {
  const zaloUserId = payload.follower?.id || payload.user_id_by_app;
  if (!zaloUserId) return;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('channel_user_id', zaloUserId)
    .single();

  if (profile) {
    await supabase
      .from('enrollments')
      .update({ status: 'dropped' })
      .eq('user_id', profile.id)
      .eq('status', 'active');
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GỬI TIN NHẮN QUA ZALO OA API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function sendZaloMessage(userId: string, text: string) {
  const { data: tokenRow } = await supabase
    .from('zalo_tokens')
    .select('access_token')
    .eq('id', 1)
    .single();

  if (!tokenRow?.access_token) {
    console.error('No Zalo access token found in DB');
    return;
  }

  try {
    const res = await fetch('https://openapi.zalo.me/v3.0/oa/message/cs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': tokenRow.access_token,
      },
      body: JSON.stringify({
        recipient: { user_id: userId },
        message: { text },
      }),
    });

    const result = await res.json();

    if (result.error !== 0) {
      console.error('Zalo API error:', result);
    }

    return result;
  } catch (err) {
    console.error('Failed to send Zalo message:', err);
  }
}
