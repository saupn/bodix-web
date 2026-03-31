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
// Hard (3 lượt) / Light (2 lượt) / Easy (1 lượt) / Recovery
// Cả 3+ đều = Done → streak +1
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function parseCheckinType(text: string): 'hard' | 'light' | 'easy' | 'recovery' | null {
  const t = text.trim().toUpperCase();

  const hard = ['HARD', 'H', '3', 'FULL', 'DONE', 'XONG', '✅', 'DA TAP'];
  const light = ['LIGHT', 'L', '2', 'NHE'];
  const easy = ['EASY', 'E', '1', 'DE', 'OK'];
  const recovery = ['REC', 'RECOVERY', 'R'];

  if (hard.some(k => t === k || t.startsWith(k + ' '))) return 'hard';
  if (light.some(k => t === k || t.startsWith(k + ' '))) return 'light';
  if (easy.some(k => t === k || t.startsWith(k + ' '))) return 'easy';
  if (recovery.some(k => t === k || t.startsWith(k + ' '))) return 'recovery';

  if (hard.some(k => t.includes(k))) return 'hard';
  if (light.some(k => t.includes(k))) return 'light';
  if (easy.some(k => t.includes(k))) return 'easy';
  if (recovery.some(k => t.includes(k))) return 'recovery';

  return null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// XỬ LÝ TIN NHẮN
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleUserMessage(payload: any) {
  const zaloUserId = payload.sender.id;
  const messageText = payload.message?.text || '';

  // ── Verify code check (phone verification via Zalo OA) ──
  const codeCandidate = messageText.trim().toUpperCase();
  if (/^[A-Z0-9]{5}$/.test(codeCandidate)) {
    const { data: verification } = await service
      .from('phone_verifications')
      .select('id, user_id, phone')
      .eq('verify_code', codeCandidate)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (verification) {
      await service
        .from('phone_verifications')
        .update({ status: 'verified', zalo_uid: zaloUserId, verified_at: new Date().toISOString() })
        .eq('id', verification.id);

      await service
        .from('profiles')
        .update({ phone_verified: true, channel_user_id: zaloUserId, phone: verification.phone })
        .eq('id', verification.user_id);

      await sendZaloMessage(zaloUserId,
        'Xác minh thành công! ✅\n\nChào mừng bạn đến với BodiX. Khi tham gia chương trình tập luyện, bạn sẽ nhận được tin nhắn nhắc tập và hỗ trợ qua Zalo.'
      );
      return;
    }
  }

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
    .select('id, user_id, cohort_id, current_day, program_id, status, programs(name, duration_days)')
    .eq('user_id', profile.id)
    .in('status', ['active', 'trial'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (enrollmentError || !enrollment) {
    // Kiểm tra trial hết hạn
    const { data: expiredTrial } = await supabase
      .from('enrollments')
      .select('id')
      .eq('user_id', profile.id)
      .eq('status', 'pending_payment')
      .limit(1)
      .maybeSingle();

    if (expiredTrial) {
      await sendZaloMessage(zaloUserId,
        '⏰ 3 ngày tập thử đã kết thúc. Thanh toán tại bodix.fit/checkout'
      );
    } else {
      await sendZaloMessage(zaloUserId,
        'Bạn chưa đăng ký chương trình. Vui lòng đăng ký tại bodix.fit nhé!'
      );
    }
    return;
  }

  // ── Kiểm tra: reply feeling (1-5) cho weekly review? ──
  if (feelingScore !== null) {
    const weekNumber = Math.ceil((enrollment.current_day || 1) / 7);
    const handled = await handleFeelingReply(zaloUserId, profile, enrollment, weekNumber, feelingScore);
    if (handled) return;
    // Nếu không phải context review → tiếp tục xử lý check-in (1/2/3 overlap)
  }

  // ── Check-in (HARD/LIGHT/EASY/RECOVERY hoặc 1/2/3) ──
  if (checkinType) {
    await handleCheckin(zaloUserId, profile, enrollment, checkinType);
    return;
  }

  // ── Không phải check-in hay feeling → kiểm tra có phải text không hợp lệ ──
  // Nếu tin nhắn ngắn (< 20 ký tự) và không match → hướng dẫn check-in
  if (messageText.trim().length < 20) {
    await sendZaloMessage(zaloUserId,
      'Mình chưa hiểu. Nhắn số nha:\n• 3 = đủ 3 lượt\n• 2 = 2 lượt\n• 1 = 1 lượt\n\nCả 3 đều tính hoàn thành!'
    );
    return;
  }

  // ── Tin nhắn dài → lưu là câu hỏi/vấn đề ──
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
  const content: string | null = messageText;
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
  const FEELING_RESPONSES: Record<number, string> = {
    5: 'Tuyệt vời! Tuần tới sẽ còn tốt hơn nữa.',
    4: 'Tốt lắm! Giữ nhịp này nha.',
    3: 'Ổn rồi. Tuần tới mệt thì cứ chọn 1 lượt nha.',
    2: 'Mình hiểu. Cứ 1 lượt nếu cần. Quan trọng là không dừng lại.',
    1: 'Cảm ơn bạn. Nghỉ ngơi đủ giấc, ăn đủ chất nha.',
  };

  await sendZaloMessage(zaloUserId, FEELING_RESPONSES[score]);

  // Nếu feeling <= 2 liên tiếp 2 tuần → insert dropout_signals
  if (score <= 2) {
    const { data: prevReview } = await service
      .from('weekly_reviews')
      .select('feeling_score')
      .eq('enrollment_id', enrollment.id)
      .eq('week_number', review.week_number - 1)
      .single();

    if (prevReview && prevReview.feeling_score !== null && prevReview.feeling_score <= 2) {
      await service.from('dropout_signals').insert({
        enrollment_id: enrollment.id,
        user_id: profile.id,
        signal_type: 'low_feeling_trend',
        risk_score: 70,
        details: `Feeling ≤ 2 hai tuần liên tiếp (tuần ${review.week_number - 1}: ${prevReview.feeling_score}, tuần ${review.week_number}: ${score})`,
        resolved: false,
      });
    }
  }

  return true;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// XỬ LÝ CHECK-IN
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleCheckin(zaloUserId: string, profile: any, enrollment: any, checkinType: 'hard' | 'light' | 'easy' | 'recovery') {

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const program = Array.isArray((enrollment as any).programs) ? (enrollment as any).programs[0] : (enrollment as any).programs;
  const programDays: number = program?.duration_days ?? 21;
  const programName: string = program?.name ?? 'BodiX 21';
  const dayNumber = (enrollment.current_day ?? 0) + 1;
  const enrollmentStatus: string = enrollment.status;

  if (dayNumber > programDays) {
    await sendZaloMessage(zaloUserId,
      `🏆 CHÚC MỪNG! Bạn đã hoàn thành ${programName}!`
    );
    return;
  }

  // Kiểm tra đã check-in ngày này chưa
  const { data: existing } = await supabase
    .from('daily_checkins')
    .select('id')
    .eq('enrollment_id', enrollment.id)
    .eq('day_number', dayNumber)
    .limit(1);

  if (existing && existing.length > 0) {
    await sendZaloMessage(zaloUserId,
      `Bạn đã check-in ngày ${dayNumber} rồi! Nghỉ ngơi và hẹn ngày mai nhé.`
    );
    return;
  }

  const workoutDate = new Date().toISOString().split('T')[0];

  // Ghi check-in
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
        `Bạn đã check-in ngày ${dayNumber} rồi! Nghỉ ngơi và hẹn ngày mai nhé.`
      );
      return;
    }
    console.error('[zalo/webhook] insert daily_checkins:', checkinError);
    await sendZaloMessage(zaloUserId, 'Có lỗi xảy ra. Vui lòng thử lại sau.');
    return;
  }

  // Cập nhật streak
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

  // Cập nhật enrollment
  const isLastDay = dayNumber >= programDays;
  const isTrialLastDay = enrollmentStatus === 'trial' && dayNumber >= 3;

  if (isTrialLastDay && !isLastDay) {
    // Trial D3 hoàn thành → trial_completed (chờ admin chọn)
    await service
      .from('enrollments')
      .update({ current_day: dayNumber, status: 'trial_completed' })
      .eq('id', enrollment.id);
  } else {
    await service
      .from('enrollments')
      .update({
        current_day: dayNumber,
        ...(isLastDay ? { status: 'completed', completed_at: new Date().toISOString() } : {}),
      })
      .eq('id', enrollment.id);
  }

  // ── Phản hồi: chỉ gửi trong 3 ngoại lệ, im lặng khi thành công bình thường ──

  // Ngoại lệ b: Ngày cuối trial (D3, status='trial')
  if (isTrialLastDay && !isLastDay) {
    await sendZaloMessage(zaloUserId,
      '🎯 3 ngày tập thử hoàn thành! Bạn sẽ được thông báo khi đợt tiếp theo mở.'
    );
    return;
  }

  // Ngoại lệ c: Ngày cuối chương trình
  if (isLastDay) {
    await sendZaloMessage(zaloUserId,
      `🏆 CHÚC MỪNG! Bạn đã hoàn thành ${programName}!`
    );
    return;
  }

  // Check-in thành công bình thường → im lặng, không gửi tin phản hồi
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
