import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/service';
import { getAccessToken } from '@/lib/messaging/helpers';

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
// AWAIT thay vì fire-and-forget: Vercel serverless đóng băng lambda
// ngay sau khi return → background Promise không chạy xong, log/send mất.
// Zalo có thể retry nếu lâu, nhưng dedup (msg_id unique) sẽ chặn xử lý trùng.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    // Nếu app_id không khớp hoặc không có → trả 200 nhưng không xử lý (Zalo verify dùng payload rỗng)
    if (!payload.app_id || payload.app_id !== process.env.ZALO_APP_ID) {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const eventName: string | undefined = payload.event_name;

    // Zalo echo lại tin OA đã gửi dưới event user_received_message → ignore ngay.
    if (eventName === 'user_received_message') {
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // AWAIT: Vercel serverless KHÔNG đảm bảo background task chạy xong sau return.
    // Phải await để handleUserMessage chạy hết (log + Zalo send) trước khi lambda đóng.
    // Dedup msg_id sẽ chặn xử lý trùng nếu Zalo retry.
    console.log('[webhook] routing event:', eventName);
    switch (eventName) {
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
        console.log('[webhook] unhandled event:', eventName);
    }
    console.log('[webhook] handler completed for event:', eventName);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error: unknown) {
    const err = error as { message?: string; stack?: string };
    console.error('[webhook] POST handler error:', err?.message, err?.stack);
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PARSE TIN NHẮN CHECK-IN
// Hard (3 lượt) / Light (2 lượt) / Easy (1 lượt) / Recovery
// Cả 3+ đều = Done → streak +1
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function parseCheckinType(text: string): 'hard' | 'light' | 'easy' | 'recovery' | null {
  const t = text.trim().toUpperCase();

  // CHỈ match exact hoặc "KEYWORD ...". KHÔNG dùng includes()
  // vì sẽ khớp sai với text bất kỳ (ví dụ "hello" có "E" → easy).
  const hard = ['HARD', 'H', '3', 'FULL', 'DONE', 'XONG', '✅', 'DA TAP'];
  const light = ['LIGHT', 'L', '2', 'NHE'];
  const easy = ['EASY', 'E', '1', 'DE', 'OK'];
  const recovery = ['REC', 'RECOVERY', 'R'];

  const match = (keys: string[]) =>
    keys.some((k) => t === k || t.startsWith(k + ' '));

  if (match(hard)) return 'hard';
  if (match(light)) return 'light';
  if (match(easy)) return 'easy';
  if (match(recovery)) return 'recovery';

  return null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// XỬ LÝ TIN NHẮN
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleUserMessage(payload: any) {
  const zaloUserId = payload.sender.id;
  const messageText = payload.message?.text || '';
  const msgId: string | undefined = payload.message?.msg_id;

  console.log('[webhook] === START ===', JSON.stringify({
    event: payload.event_name,
    msgId,
    text: messageText.substring(0, 60),
    uid: zaloUserId,
    ts: new Date().toISOString(),
  }));

  try {
  // ── Dedup: Zalo có thể retry webhook → chặn mọi xử lý cùng msg_id. ──
  // Chỉ return khi chắc chắn đã xử lý (23505 unique violation).
  // Với lỗi khác (timeout, network) → log và tiếp tục — chấp nhận risk gửi trùng
  // thay vì không phản hồi gì.
  if (msgId) {
    const dedupPromise = service
      .from('zalo_webhook_events')
      .insert({
        msg_id: msgId,
        zalo_uid: zaloUserId,
        event_name: payload.event_name ?? 'user_send_text',
      });
    const timeoutPromise = new Promise<{ error: { code: string; message: string } }>((_, reject) =>
      setTimeout(() => reject(new Error('dedup timeout')), 4000),
    );

    let dedupTimedOut = false;
    try {
      const { error: dedupError } = await Promise.race([dedupPromise, timeoutPromise]);
      if (dedupError) {
        if (dedupError.code === '23505') {
          console.log('[webhook] DEDUP SKIP msg_id:', msgId, '(already processed)');
          return;
        }
        console.warn('[webhook] DEDUP FAILED, continuing:', dedupError.message || dedupError);
      }
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err?.code === '23505') {
        console.log('[webhook] DEDUP SKIP msg_id:', msgId, '(already processed)');
        return;
      }
      dedupTimedOut = true;
      console.warn('[webhook] DEDUP FAILED/TIMEOUT, will re-check:', err?.message || e);
    }

    // Sau timeout: re-check tồn tại trước khi tiếp tục xử lý.
    // Nếu insert race-condition đã thắng (Zalo retry trước), select sẽ thấy row → skip.
    if (dedupTimedOut) {
      try {
        const { data: existing } = await service
          .from('zalo_webhook_events')
          .select('msg_id')
          .eq('msg_id', msgId)
          .maybeSingle();
        if (existing) {
          console.log('[webhook] DEDUP SKIP (re-check found):', msgId);
          return;
        }
      } catch (recheckErr: unknown) {
        const err = recheckErr as { message?: string };
        console.warn('[webhook] re-check also failed, continuing:', err?.message || recheckErr);
      }
    }
  }

  console.log('[webhook] dedup passed msg_id:', msgId);
  console.log('[webhook] RECEIVED msg_id:', msgId, 'text:', messageText, 'uid:', zaloUserId);

  // ── Single-send guard: mỗi request CHỈ được gửi tối đa 1 tin qua Zalo. ──
  // Scope: chỉ trong handleUserMessage. KHÔNG ảnh hưởng cron/admin (vẫn dùng sendZaloMessage trực tiếp).
  let messageSentInThisRequest = false;
  const safeSend = async (uid: string, text: string) => {
    if (messageSentInThisRequest) {
      console.log(
        '[webhook] BLOCKED extra send, msg_id:', msgId,
        'preview:', text.substring(0, 50),
      );
      return;
    }
    messageSentInThisRequest = true;
    console.log('[webhook] ABOUT TO SEND to:', uid, 'message:', text.substring(0, 50));
    const sendResult = await sendZaloMessage(uid, text);
    console.log('[webhook] SEND RESULT:', JSON.stringify(sendResult));
  };

  // ── Verify code check (phone verification via Zalo OA) ──
  const codeCandidate = messageText.trim().toUpperCase();
  const isVerifyCodeFormat = /^[A-Z0-9]{5}$/.test(codeCandidate);
  console.log('[webhook] verify code check:', isVerifyCodeFormat, 'candidate:', codeCandidate);
  if (isVerifyCodeFormat) {
    const { data: verification } = await service
      .from('phone_verifications')
      .select('id, user_id, phone')
      .eq('verify_code', codeCandidate)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    console.log('[webhook] verify code matched in DB:', !!verification);
    if (verification) {
      console.log('[webhook] matched=verify msg_id:', msgId);
      await service
        .from('phone_verifications')
        .update({ status: 'verified', zalo_uid: zaloUserId, verified_at: new Date().toISOString() })
        .eq('id', verification.id);

      await service
        .from('profiles')
        .update({ phone_verified: true, channel_user_id: zaloUserId, phone: verification.phone })
        .eq('id', verification.user_id);

      await safeSend(zaloUserId,
        'Xác minh thành công! ✅\n\nQuay lại trang bodix.fit để tiếp tục đăng ký nha.'
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

  console.log('[webhook] profile:', profile?.id, 'channel_user_id:', zaloUserId, 'error:', profileError?.message);

  if (profileError || !profile) {
    console.log('[webhook] matched=no_profile msg_id:', msgId);
    await safeSend(zaloUserId,
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
    .maybeSingle();

  console.log('[webhook] enrollment:', enrollment?.status, enrollment?.id, 'error:', enrollmentError?.message);

  if (enrollmentError) {
    console.error('[webhook] enrollment query error:', enrollmentError);
  }

  if (!enrollment) {
    // Kiểm tra các status khác để phản hồi phù hợp (chỉ 1 lần mỗi status)
    const { data: otherEnrollment } = await supabase
      .from('enrollments')
      .select('status')
      .eq('user_id', profile.id)
      .in('status', ['trial_completed', 'pending_payment', 'paid_waiting_cohort', 'completed', 'paused', 'dropped'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const status = otherEnrollment?.status;
    console.log('[webhook] matched=no_active_enrollment msg_id:', msgId, 'status:', status);

    if (status === 'trial_completed' || status === 'paid_waiting_cohort') {
      await safeSend(zaloUserId,
        'Bạn đã hoàn thành tập thử. Chờ thông báo để tham gia chính thức nhé!'
      );
    } else if (status === 'pending_payment') {
      await safeSend(zaloUserId,
        '⏰ 3 ngày tập thử đã kết thúc. Thanh toán tại bodix.fit/checkout'
      );
    } else if (status === 'completed') {
      await safeSend(zaloUserId,
        '🏆 Bạn đã hoàn thành chương trình rồi! Chờ thông báo đợt tiếp theo nha.'
      );
    } else if (status === 'paused') {
      await safeSend(zaloUserId,
        'Enrollment của bạn đang tạm dừng. Liên hệ bodix.fit để tiếp tục nhé.'
      );
    } else {
      await safeSend(zaloUserId,
        'Bạn chưa đăng ký chương trình. Vui lòng đăng ký tại bodix.fit nhé!'
      );
    }
    return;
  }

  // ── Kiểm tra: reply feeling (1-5) cho weekly review? ──
  if (feelingScore !== null) {
    const weekNumber = Math.ceil((enrollment.current_day || 1) / 7);
    const handled = await handleFeelingReply(zaloUserId, profile, enrollment, weekNumber, feelingScore, safeSend);
    console.log('[webhook] feeling check:', feelingScore, 'handled:', handled);
    if (handled) {
      console.log('[webhook] matched=feeling msg_id:', msgId, 'score:', feelingScore);
      return;
    }
    // Nếu không phải context review → tiếp tục xử lý check-in (1/2/3 overlap)
  } else {
    console.log('[webhook] feeling check: null (not a feeling reply)');
  }

  // ── Check-in (HARD/LIGHT/EASY/RECOVERY hoặc 1/2/3) ──
  console.log('[webhook] checkin type parsed:', checkinType);
  if (checkinType) {
    console.log('[webhook] CHECKIN matched, mode:', checkinType, 'enrollment:', enrollment.id);
    await handleCheckin(zaloUserId, profile, enrollment, checkinType, safeSend);
    return;
  }

  // ── Không phải check-in hay feeling → kiểm tra có phải text không hợp lệ ──
  // Nếu tin nhắn ngắn (< 20 ký tự) và không match → hướng dẫn check-in
  if (messageText.trim().length < 20) {
    console.log('[webhook] matched=invalid_short msg_id:', msgId);
    await safeSend(zaloUserId,
      'Mình chưa hiểu. Nhắn số nha:\n• 3 = đủ 3 lượt\n• 2 = 2 lượt\n• 1 = 1 lượt\n\nCả 3 đều tính hoàn thành!'
    );
    return;
  }

  // ── Tin nhắn dài → lưu là câu hỏi/vấn đề ──
  console.log('[webhook] matched=question msg_id:', msgId);
  await saveUserQuestion(zaloUserId, profile, enrollment, messageText, payload, safeSend);
  } catch (error: unknown) {
    const err = error as { message?: string; stack?: string };
    console.error(
      '[webhook] FATAL ERROR in handleUserMessage msg_id:', msgId,
      'message:', err?.message,
      'stack:', err?.stack,
    );
  }
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
async function saveUserQuestion(
  zaloUserId: string,
  profile: any,
  enrollment: any,
  messageText: string,
  payload: any,
  safeSend: (uid: string, text: string) => Promise<void>,
) {
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

  await safeSend(zaloUserId,
    'Cảm ơn bạn! Mình đã ghi nhận và sẽ giải đáp trong video review cuối tuần nhé.'
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// XỬ LÝ FEELING REPLY (1-5) CHO WEEKLY REVIEW
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleFeelingReply(
  zaloUserId: string,
  profile: any,
  enrollment: any,
  weekNumber: number,
  score: number,
  safeSend: (uid: string, text: string) => Promise<void>,
): Promise<boolean> {
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

  await safeSend(zaloUserId, FEELING_RESPONSES[score]);

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
async function handleCheckin(
  zaloUserId: string,
  profile: any,
  enrollment: any,
  checkinType: 'hard' | 'light' | 'easy' | 'recovery',
  safeSend: (uid: string, text: string) => Promise<void>,
) {

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const program = Array.isArray((enrollment as any).programs) ? (enrollment as any).programs[0] : (enrollment as any).programs;
  const programDays: number = program?.duration_days ?? 21;
  const programName: string = program?.name ?? 'BodiX 21';
  const dayNumber = (enrollment.current_day ?? 0) + 1;

  if (dayNumber > programDays) {
    await safeSend(zaloUserId,
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
    await safeSend(zaloUserId,
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
      await safeSend(zaloUserId,
        `Bạn đã check-in ngày ${dayNumber} rồi! Nghỉ ngơi và hẹn ngày mai nhé.`
      );
      return;
    }
    console.error('[zalo/webhook] insert daily_checkins:', checkinError);
    await safeSend(zaloUserId, 'Có lỗi xảy ra. Vui lòng thử lại sau.');
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

  // Cập nhật enrollment — CHỈ update current_day cho trial.
  // Việc chuyển status 'trial' → 'trial_completed' và gửi tin "🎯 3 ngày tập thử hoàn thành"
  // do cron rescue-check xử lý. Tránh tin gửi 2 lần khi Zalo retry webhook (dedup miss).
  const isLastDay = dayNumber >= programDays;

  await service
    .from('enrollments')
    .update({
      current_day: dayNumber,
      ...(isLastDay ? { status: 'completed', completed_at: new Date().toISOString() } : {}),
    })
    .eq('id', enrollment.id);

  // Ngày cuối chương trình
  if (isLastDay) {
    await safeSend(zaloUserId,
      `🏆 CHÚC MỪNG! Bạn đã hoàn thành ${programName}!`
    );
    return;
  }

  // Phản hồi thông thường theo loại check-in
  const CHECKIN_RESPONSES: Record<'hard' | 'light' | 'easy' | 'recovery', string> = {
    hard: '💪 Tuyệt vời! 3 lượt – bạn thật sự nghiêm túc!',
    light: '👏 Giỏi lắm! 2 lượt là rất tốt rồi!',
    easy: '✅ Hoàn thành! 1 lượt cũng là chiến thắng!',
    recovery: '🧘 Recovery xong! Cơ thể cảm ơn bạn đó.',
  };

  await safeSend(zaloUserId, CHECKIN_RESPONSES[checkinType]);
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
  console.log('[webhook] SENDING response to:', userId);

  let accessToken: string;
  try {
    accessToken = await getAccessToken();
  } catch (error: unknown) {
    const err = error as { message?: string; cause?: unknown };
    console.error('[webhook] SEND FAILED: cannot get access token:', err?.message, err?.cause);
    return { error: -1, message: 'getAccessToken failed', detail: err?.message };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch('https://openapi.zalo.me/v3.0/oa/message/cs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': accessToken,
      },
      body: JSON.stringify({
        recipient: { user_id: userId },
        message: { text },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const result = await res.json();
    console.log('[zalo] send result:', JSON.stringify(result));

    if (result.error !== 0) {
      console.error('[zalo] API error:', result.error, result.message);
    }

    return result;
  } catch (error: unknown) {
    clearTimeout(timeout);
    const err = error as { name?: string; message?: string; cause?: unknown };
    console.error('[zalo] sendZaloMessage FAILED:', err?.name, err?.message, err?.cause);
    return { error: -1, message: err?.message ?? 'fetch failed', name: err?.name };
  }
}
