import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const service = createServiceClient();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PARSE FEELING SCORE (1-5) cho weekly review
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function parseFeelingScore(text: string): number | null {
  const t = text.trim();
  const n = parseInt(t, 10);
  if (n >= 1 && n <= 5 && t === String(n)) return n;
  return null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PHÂN LOẠI TỰ ĐỘNG (keyword matching)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function categorizeQuestion(text: string): string {
  const lower = text.toLowerCase();
  if (['form', 'tư thế', 'đúng không', 'sai không', 'kiểm tra'].some(k => lower.includes(k))) return 'form_check';
  if (['đau', 'nhức', 'chấn thương', 'bị thương'].some(k => lower.includes(k))) return 'pain_injury';
  if (['ăn', 'dinh dưỡng', 'protein', 'calo', 'diet'].some(k => lower.includes(k))) return 'nutrition';
  if (['chán', 'mệt', 'không muốn', 'bỏ', 'khó'].some(k => lower.includes(k))) return 'motivation';
  if (['lịch', 'thời gian', 'bận', 'trễ'].some(k => lower.includes(k))) return 'schedule';
  return 'other';
}

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

    // Nếu app_id không khớp hoặc không có → trả 200 nhưng không xử lý (Zalo verify dùng payload rỗng)
    if (!payload.app_id || payload.app_id !== process.env.ZALO_APP_ID) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // Xử lý events
    switch (payload.event_name) {
      case 'user_send_text':
        await handleUserMessage(payload);
        break;
      case 'user_send_image':
      case 'user_send_file':
      case 'user_send_audio':
      case 'user_send_video':
        await handleUserMedia(payload);
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleUserMessage(payload: any) {
  const zaloUserId = payload.sender.id;
  const messageText = payload.message?.text || '';
  const checkinType = parseCheckinType(messageText);
  const feelingScore = parseFeelingScore(messageText);

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

  // 2. Tìm enrollment active hoặc trial
  const { data: enrollment, error: enrollmentError } = await supabase
    .from('enrollments')
    .select('id, user_id, cohort_id, current_day, program_id, programs(duration_days)')
    .eq('user_id', profile.id)
    .in('status', ['active', 'trial'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (enrollmentError || !enrollment) {
    await sendZaloMessage(zaloUserId,
      'Bạn chưa đăng ký chương trình. Vui lòng đăng ký tại bodix.fit nhé!'
    );
    return;
  }

  // ── Kiểm tra: reply feeling (1-5) cho weekly review? ──
  // Nếu tin nhắn là số 1-5 và user có weekly_review chưa reply feeling
  if (feelingScore !== null) {
    const weekNumber = Math.ceil((enrollment.current_day || 1) / 7);
    const handled = await handleFeelingReply(zaloUserId, profile, enrollment, weekNumber, feelingScore);
    if (handled) return;
    // Nếu không phải context review → tiếp tục xử lý check-in (1/2/3 overlap)
  }

  // ── Check-in (HARD/LIGHT/EASY hoặc 1/2/3) ──
  if (checkinType) {
    await handleCheckin(zaloUserId, profile, enrollment, checkinType);
    return;
  }

  // ── Không phải check-in → lưu là câu hỏi/vấn đề ──
  await saveUserQuestion(zaloUserId, profile, enrollment, messageText, payload);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// XỬ LÝ MEDIA TỪ ZALO (ảnh/video/audio/file)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleUserMedia(payload: any) {
  const zaloUserId = payload.sender.id;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('channel_user_id', zaloUserId)
    .single();

  if (!profile) return;

  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id, user_id, cohort_id, current_day')
    .eq('user_id', profile.id)
    .in('status', ['active', 'trial'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!enrollment) return;

  // Xác định loại media
  let messageType: 'image' | 'video' | 'voice' = 'image';
  let mediaUrl: string | null = null;
  const content = payload.message?.text || null;

  if (payload.message?.attachments) {
    const attachment = payload.message.attachments[0];
    if (attachment.type === 'image' || payload.event_name === 'user_send_image') {
      messageType = 'image';
      mediaUrl = attachment.payload?.url || attachment.payload?.thumbnail;
    } else if (attachment.type === 'video' || payload.event_name === 'user_send_video') {
      messageType = 'video';
      mediaUrl = attachment.payload?.url;
    } else if (attachment.type === 'audio' || payload.event_name === 'user_send_audio') {
      messageType = 'voice';
      mediaUrl = attachment.payload?.url;
    }
  }

  const weekNumber = Math.ceil((enrollment.current_day || 1) / 7);

  await service.from('user_questions').insert({
    enrollment_id: enrollment.id,
    user_id: profile.id,
    cohort_id: enrollment.cohort_id,
    week_number: weekNumber,
    message_type: messageType,
    content,
    media_url: mediaUrl,
    category: content ? categorizeQuestion(content) : 'other',
    status: 'new',
  });

  await sendZaloMessage(zaloUserId,
    'Cảm ơn bạn! Mình đã ghi nhận và sẽ giải đáp trong video review cuối tuần nhé.'
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LƯU CÂU HỎI/VẤN ĐỀ
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function saveUserQuestion(zaloUserId: string, profile: any, enrollment: any, messageText: string, payload: any) {
  const weekNumber = Math.ceil((enrollment.current_day || 1) / 7);

  let messageType: 'text' | 'image' | 'video' | 'voice' = 'text';
  let content: string | null = messageText;
  let mediaUrl: string | null = null;

  if (payload.message?.attachments) {
    const attachment = payload.message.attachments[0];
    if (attachment.type === 'image') {
      messageType = 'image';
      mediaUrl = attachment.payload?.url;
    } else if (attachment.type === 'video') {
      messageType = 'video';
      mediaUrl = attachment.payload?.url;
    } else if (attachment.type === 'audio') {
      messageType = 'voice';
      mediaUrl = attachment.payload?.url;
    }
  }

  await service.from('user_questions').insert({
    enrollment_id: enrollment.id,
    user_id: profile.id,
    cohort_id: enrollment.cohort_id,
    week_number: weekNumber,
    message_type: messageType,
    content,
    media_url: mediaUrl,
    category: categorizeQuestion(content || ''),
    status: 'new',
  });

  await sendZaloMessage(zaloUserId,
    'Cảm ơn bạn! Mình đã ghi nhận và sẽ giải đáp trong video review cuối tuần nhé.'
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// XỬ LÝ FEELING REPLY (1-5) CHO WEEKLY REVIEW
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleFeelingReply(zaloUserId: string, profile: any, enrollment: any, weekNumber: number, score: number): Promise<boolean> {
  // Kiểm tra có weekly_review chưa reply feeling không
  const { data: review } = await service
    .from('weekly_reviews')
    .select('id, week_number')
    .eq('enrollment_id', enrollment.id)
    .is('feeling_score', null)
    .not('review_video_id', 'is', null)
    .order('week_number', { ascending: false })
    .limit(1)
    .single();

  if (!review) return false; // Không có review chờ feeling → không phải context review

  // Update feeling
  await service
    .from('weekly_reviews')
    .update({
      feeling_score: score,
      feeling_replied_at: new Date().toISOString(),
    })
    .eq('id', review.id);

  // Phản hồi theo score
  let response = '';
  if (score === 5) response = 'Tuyệt vời! Năng lượng cao — tuần tới sẽ còn tốt hơn.';
  else if (score === 4) response = 'Tốt lắm! Giữ nhịp này nhé.';
  else if (score === 3) response = 'Ổn rồi. Nếu tuần tới mệt hơn, 1 lượt cũng là hoàn thành.';
  else if (score === 2) response = 'Mình hiểu. Tuần tới cứ chọn 1 lượt nếu cần. Quan trọng là không dừng lại.';
  else response = 'Cảm ơn bạn đã chia sẻ. Nghỉ ngơi đủ giấc, ăn đủ chất nhé.';

  const nextWeek = review.week_number + 1;
  response += `\n\nTuần ${nextWeek}:\nHẹn sáng thứ Hai nhé!`;

  await sendZaloMessage(zaloUserId, response);

  // Nếu feeling <= 2 liên tiếp 2 tuần → flag rescue
  if (score <= 2) {
    const { data: prevReview } = await service
      .from('weekly_reviews')
      .select('feeling_score')
      .eq('enrollment_id', enrollment.id)
      .eq('week_number', review.week_number - 1)
      .single();

    if (prevReview && prevReview.feeling_score !== null && prevReview.feeling_score <= 2) {
      await service.from('rescue_interventions').insert({
        enrollment_id: enrollment.id,
        user_id: profile.id,
        trigger_reason: 'low_feeling_sustained',
        action_taken: `Feeling score <= 2 cho 2 tuần liên tiếp (tuần ${review.week_number - 1}: ${prevReview.feeling_score}, tuần ${review.week_number}: ${score})`,
        outcome: 'pending',
      });
    }
  }

  return true;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// XỬ LÝ CHECK-IN
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleCheckin(zaloUserId: string, profile: any, enrollment: any, checkinType: 'hard' | 'light' | 'easy') {

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const programDays = ((enrollment as any).programs?.duration_days) ?? ((enrollment as any).programs?.[0]?.duration_days) ?? 21;
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
    total_recovery_days: prev.total_recovery_days, // Zalo chỉ reply HARD/LIGHT/EASY
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
