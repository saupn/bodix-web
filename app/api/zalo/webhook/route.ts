import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/service';
import { getAccessToken } from '@/lib/messaging/helpers';
import { matchFAQ, isNonsenseMessage, FALLBACK_REPLY, NONSENSE_REPLY } from '@/lib/zalo/faq';
import { parseCheckin, roundsToMode } from '@/lib/zalo/parse-checkin';
import { buildRescueAckMessage } from '@/lib/rescue/escalation';
import { getTrialMorningAnchorDate, TRIAL_DAYS } from '@/lib/trial/utils';
import {
  getVietnamDateString,
  isoTimestampToVietnamYmd,
  calendarDaysBetween,
  formatDateVn,
} from '@/lib/date/vietnam';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const service = createServiceClient();

// Phản hồi xác nhận check-in theo số lượt — completion-first: khích lệ mọi mức độ.
// Dùng chung cho cả check-in active (daily_checkins) lẫn trial (trial_activities).
const CHECKIN_RESPONSES: Record<1 | 2 | 3, string> = {
  3: '💪 Tuyệt vời! Bạn đã hoàn thành đủ 3 lượt hôm nay. Giữ vững nhịp này nhé!',
  2: '👏 Làm tốt lắm! 2 lượt hôm nay là một bước tiến. Mai mình cùng cố thêm nhé!',
  1: '✅ Hoàn thành 1 lượt vẫn hơn không tập. Quan trọng là bạn đã bước lên thảm hôm nay!',
};

// Map mode (daily_checkins) → số lượt, để so sánh khi user nhập lại số khác.
function modeToRounds(mode: string): 1 | 2 | 3 {
  return mode === 'hard' ? 3 : mode === 'light' ? 2 : 1;
}

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
      .insert({ msg_id: msgId });
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
      // Update profiles TRƯỚC (nguồn sự thật cho FE poll + hard gate
      // complete-onboarding). Lỗi → KHÔNG báo success giả; để user gửi lại
      // mã (phone_verifications vẫn 'pending' nên resend match lại được).
      const { error: profileUpdateError } = await service
        .from('profiles')
        .update({
          phone_verified: true,
          zalo_verified: true,
          zalo_phone: verification.phone,
          channel_user_id: zaloUserId,
          preferred_channel: 'zalo',
          phone: verification.phone,
        })
        .eq('id', verification.user_id);

      if (profileUpdateError) {
        console.error(
          '[webhook] verify: profiles update FAILED msg_id:', msgId,
          'user_id:', verification.user_id,
          'err:', profileUpdateError.message,
        );
        await safeSend(zaloUserId,
          'Có lỗi khi xác minh, bạn gửi lại mã giúp mình nhé. Nếu vẫn lỗi, thử lại sau ít phút.'
        );
        return;
      }

      // profiles đã link xong → đánh dấu phone_verifications.
      // Lỗi ở đây KHÔNG chặn user (linkage đã thành công), chỉ log.
      const { error: pvUpdateError } = await service
        .from('phone_verifications')
        .update({ status: 'verified', zalo_uid: zaloUserId, verified_at: new Date().toISOString() })
        .eq('id', verification.id);

      if (pvUpdateError) {
        console.error(
          '[webhook] verify: phone_verifications update failed (non-fatal) msg_id:', msgId,
          'id:', verification.id,
          'err:', pvUpdateError.message,
        );
      }

      await safeSend(zaloUserId,
        'Xác minh thành công! ✅\n\nQuay lại trang bodix.fit để tiếp tục đăng ký nha.'
      );
      return;
    }
  }

  const checkin = parseCheckin(messageText);
  const feelingScore = parseFeelingScore(messageText);

  // 1. Tìm profile theo channel_user_id (Zalo UID). KHÔNG .single() — duplicate
  //    channel_user_id tồn tại; .order(created_at desc)+limit(1)+maybeSingle để
  //    lấy profile mới nhất, không throw. profile có thể null (chưa đăng ký) —
  //    KHÔNG return sớm: user chưa đăng ký vẫn được trả lời FAQ.
  const zaloUid = String(zaloUserId ?? '').trim();

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, phone, phone_verified, channel_user_id, trial_ends_at, bodix_start_date')
    .eq('channel_user_id', zaloUid)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // 2. Nếu có profile + enrollment đang chạy: xử lý LỆNH chức năng
  //    (feeling review 1-5 / check-in 1/2/3 số lượt). Verify code (5 ký tự) đã
  //    xử lý phía trên. Đây KHÔNG phải reply state-aware — là lệnh thật, và được
  //    ưu tiên TRƯỚC nonsense filter + FAQ để "1/2/3" luôn ghi nhận check-in.
  if (profile) {
    const { data: enrollmentRows, error: enrollmentError } = await supabase
      .from('enrollments')
      .select('id, user_id, cohort_id, current_day, program_id, status, enrolled_at, created_at, programs(name, duration_days)')
      .eq('user_id', profile.id)
      .in('status', ['active', 'trial', 'trial_completed', 'pending_payment', 'paid_waiting_cohort', 'completed', 'dropped'])
      .order('created_at', { ascending: false });

    if (enrollmentError) {
      console.error('[webhook] enrollment query error:', enrollmentError);
    }

    const enrollments = enrollmentRows ?? [];

    // ── Phân loại enrollment ──
    // ACTIVE (trong cohort) ưu tiên cao nhất nếu user vừa trial vừa active.
    const activeEnrollment = enrollments.find((e) => e.status === 'active') ?? null;

    // TRIAL-ish: còn trong 3 ngày trải nghiệm thử (trial_ends_at còn hạn theo
    // NGÀY lịch VN — cho phép check-in cả ngày cuối dù timestamp đã qua giờ).
    const todayVN = getVietnamDateString();
    const trialStillValid =
      !!profile.trial_ends_at &&
      isoTimestampToVietnamYmd(profile.trial_ends_at) >= todayVN;
    const trialEnrollment = trialStillValid
      ? enrollments.find((e) =>
          ['trial', 'pending_payment', 'paid_waiting_cohort'].includes(e.status),
        ) ?? null
      : null;

    // Enrollment dùng cho feeling-reply (ưu tiên active, else gần nhất).
    const primaryEnrollment = activeEnrollment ?? enrollments[0] ?? null;

    // Feeling reply (1-5) cho weekly review — chỉ xử lý khi có review chờ feeling.
    if (primaryEnrollment && feelingScore !== null) {
      const weekNumber = Math.ceil((primaryEnrollment.current_day || 1) / 7);
      const handled = await handleFeelingReply(zaloUserId, profile, primaryEnrollment, weekNumber, feelingScore, safeSend);
      if (handled) {
        console.log('[webhook] matched=feeling msg_id:', msgId, 'score:', feelingScore);
        return;
      }
    }

    // Check-in "1"/"2"/"3" — phân nhánh ACTIVE (daily_checkins) vs TRIAL (trial_activities).
    if (checkin.isCheckin) {
      if (activeEnrollment) {
        console.log('[webhook] CHECKIN active, rounds:', checkin.rounds, 'enrollment:', activeEnrollment.id);
        await handleCheckin(zaloUserId, profile, activeEnrollment, checkin.rounds, safeSend);
        return;
      }
      if (trialEnrollment) {
        console.log('[webhook] CHECKIN trial, rounds:', checkin.rounds, 'enrollment:', trialEnrollment.id);
        await handleTrialCheckin(zaloUserId, profile, trialEnrollment, checkin.rounds, safeSend);
        return;
      }
      // Có enrollment nhưng không buổi nào đang mở (completed/dropped/trial_completed
      // / trial hết hạn) → KHÔNG ghi; trả lời nhẹ nhàng, dẫn về web — tránh rơi vào
      // nonsense filter trả lời sai cho "1/2/3".
      if (enrollments.length > 0) {
        await safeSend(zaloUserId,
          'Hiện bạn chưa có buổi tập nào đang mở để ghi nhận. Ghé bodix.fit để xem chương trình của mình nhé!'
        );
        console.log('[webhook] checkin no-eligible-enrollment msg_id:', msgId);
        return;
      }
      // Hoàn toàn chưa enroll → để rơi xuống FAQ/fallback bên dưới.
    }

    // ── Tâm sự sau tin rescue (TRƯỚC nonsense/FAQ, SAU check-in) ──
    // Chỉ tin CÓ CHỮ mới là tâm sự: tin thuần số ("1", "2", "3", "4", "5") luôn dành
    // cho check-in / feeling-reply đã xử lý phía trên. Nếu chúng rơi xuống đây (không
    // có buổi nào mở, không có review chờ) thì cũng KHÔNG phải lời tâm sự.
    const confideText = messageText.trim();
    const isPureNumber = /^\d{1,2}$/.test(confideText);
    if (confideText.length > 0 && !isPureNumber) {
      const confided = await handleRescueConfide(
        zaloUserId,
        profile,
        primaryEnrollment?.id ?? null,
        confideText,
        safeSend,
      );
      if (confided) {
        console.log('[webhook] matched=rescue_confide msg_id:', msgId, 'user:', profile.id);
        return;
      }
    }
  }

  // 3. Tầng FAQ — THAY HOÀN TOÀN logic state-aware cũ (không còn "bạn đã thanh
  //    toán", "bạn đã hoàn thành"...). Áp dụng cho mọi tin nhắn không phải lệnh
  //    chức năng, bất kể user đã đăng ký hay chưa.
  const matched = matchFAQ(messageText);
  const nonsense = isNonsenseMessage(messageText);

  // Log structured cho analytics sau launch: FAQ nào hỏi nhiều, tin nào miss, spam.
  console.log(JSON.stringify({
    event: 'zalo_user_message',
    zalo_user_id: zaloUserId,
    message_length: messageText.length,
    matched_faq_id: matched?.id || null,
    is_nonsense: nonsense,
    timestamp: new Date().toISOString(),
  }));

  if (nonsense) {
    await safeSend(zaloUserId, NONSENSE_REPLY);
    console.log('[webhook] matched=nonsense msg_id:', msgId);
    return;
  }

  if (matched) {
    await safeSend(zaloUserId, matched.answer);
    console.log(`[zalo-webhook] FAQ matched: ${matched.id} for user ${zaloUserId} (msg_id: ${msgId})`);
    return;
  }

  await safeSend(zaloUserId, FALLBACK_REPLY);
  console.log(`[zalo-webhook] No FAQ match for user ${zaloUserId} (msg_id: ${msgId}), message: "${messageText.substring(0, 100)}"`);
  return;
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

  // KHÔNG .single() — throw khi >1 profile trùng channel_user_id.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name')
    .eq('channel_user_id', String(zaloUserId ?? '').trim())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

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
// XỬ LÝ TÂM SỰ SAU TIN RESCUE
// Tin rescue mời user "cứ nhắn cho mình biết". Trong 48h sau đó, tin text
// (không phải số check-in) = tâm sự → câu ấm áp tức thì + flag cho Founder trả
// lời tay. KHÔNG đẩy vào FAQ/fallback: user vừa mở lòng, câu máy móc phản tác dụng.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Đóng cửa sổ awaiting khi user đã quay lại tập (không cần theo dõi chia sẻ nữa). */
async function clearRescueAwaiting(userId: string): Promise<void> {
  const { error } = await service
    .from('rescue_interventions')
    .update({ awaiting_reply_until: null })
    .eq('user_id', userId)
    .not('awaiting_reply_until', 'is', null);
  if (error) {
    console.error('[webhook] clearRescueAwaiting failed:', userId, error.message);
  }
}

async function handleRescueConfide(
  zaloUserId: string,
  profile: { id: string; full_name: string | null },
  enrollmentId: string | null,
  messageText: string,
  safeSend: (uid: string, text: string) => Promise<void>,
): Promise<boolean> {
  // Cửa sổ 48h còn mở? (rescue gần nhất, awaiting chưa hết hạn và chưa bị check-in đóng)
  const { data: rescue } = await service
    .from('rescue_interventions')
    .select('id, enrollment_id')
    .eq('user_id', profile.id)
    .gt('awaiting_reply_until', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!rescue) return false;

  const todayVN = getVietnamDateString();

  // Câu ấm áp tối đa 1 lần/ngày/user — user nhắn tiếp vẫn được ghi nhận cho Founder,
  // chỉ không lặp lại câu chào. Check TRƯỚC khi insert để row mới không tự match.
  const { data: ackedToday } = await service
    .from('rescue_replies')
    .select('id')
    .eq('user_id', profile.id)
    .eq('received_ymd', todayVN)
    .eq('ack_sent', true)
    .limit(1)
    .maybeSingle();

  const shouldAck = !ackedToday;

  const { error: insertError } = await service.from('rescue_replies').insert({
    user_id: profile.id,
    enrollment_id: rescue.enrollment_id ?? enrollmentId,
    rescue_intervention_id: rescue.id,
    message_text: messageText,
    received_ymd: todayVN,
    ack_sent: shouldAck,
    status: 'needs_founder_reply',
  });

  if (insertError) {
    // Ghi hỏng → vẫn trả lời ấm áp (không để user nhận câu FAQ lạnh), nhưng log to
    // để Founder biết có tin bị mất khỏi inbox.
    console.error('[webhook] rescue_replies insert FAILED:', profile.id, insertError.message);
  }

  if (shouldAck) {
    const displayName = profile.full_name?.split(' ').pop() || profile.full_name || 'bạn';
    await safeSend(zaloUserId, buildRescueAckMessage(displayName));
  }

  // KHÔNG đóng cửa sổ awaiting ở đây — user có thể nhắn tiếp.
  return true;
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
  // Kiểm tra có weekly_review chưa reply feeling không.
  // KHÔNG yêu cầu review_video_id: tin Review CN tự động có thể không kèm video.
  const { data: review } = await service
    .from('weekly_reviews')
    .select('id, week_number, created_at')
    .eq('enrollment_id', enrollment.id)
    .is('feeling_score', null)
    .order('week_number', { ascending: false })
    .limit(1)
    .single();

  if (!review) return false; // Không có review chờ feeling → không phải context review

  // Chống nuốt nhầm check-in: số 1–3 vừa là feeling vừa là số lượt tập.
  // Chỉ nhận 1–3 làm feeling khi review được tạo HÔM NAY (VN) — tức đúng ngày CN
  // vừa gửi tin Review. Số 4–5 không phải số lượt hợp lệ nên nhận bất cứ lúc nào.
  // Nhờ vậy một review CN cũ chưa trả lời sẽ KHÔNG cướp "1/2/3" check-in ngày thường.
  if (score <= 3) {
    const todayVN = getVietnamDateString();
    const reviewYmd = review.created_at
      ? isoTimestampToVietnamYmd(review.created_at)
      : null;
    if (reviewYmd !== todayVN) return false;
  }

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
  rounds: 1 | 2 | 3,
  safeSend: (uid: string, text: string) => Promise<void>,
) {
  // User đã quay lại tập → đóng cửa sổ awaiting của tin rescue (nếu có). Tin text
  // sau đó xử lý bình thường (FAQ/fallback). rescue_replies đã ghi vẫn chờ Founder.
  await clearRescueAwaiting(profile.id);

  // Số lượt → mode lưu DB (daily_checkins không có cột rounds riêng).
  const checkinMode = roundsToMode(rounds);

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

  // Dedup theo workout_date (VN timezone). UTC midnight ≠ VN midnight:
  // 6:44 SA VN = 23:44 UTC ngày hôm trước → toISOString() trả ngày hôm trước
  // → query bằng UTC date sẽ miss row hôm nay → insert tiếp tục thành công ở day mới.
  const vnNow = new Date(Date.now() + 7 * 3600000);
  const todayVN = vnNow.toISOString().split('T')[0];
  const { data: existingCheckin } = await supabase
    .from('daily_checkins')
    .select('id, mode')
    .eq('enrollment_id', enrollment.id)
    .eq('workout_date', todayVN)
    .maybeSingle();

  if (existingCheckin) {
    console.log('[webhook] CHECK-IN ALREADY EXISTS for today (VN)');
    // Cùng số lượt → đã ghi rồi.
    if (existingCheckin.mode === checkinMode) {
      await safeSend(zaloUserId, 'Bạn đã ghi nhận tập hôm nay rồi. Hẹn gặp lại ngày mai nhé!');
      return;
    }
    // Số lượt KHÁC → latest-wins: cập nhật mode + điều chỉnh breakdown streak.
    await service
      .from('daily_checkins')
      .update({ mode: checkinMode, completed_at: new Date().toISOString() })
      .eq('id', existingCheckin.id);
    await adjustStreakMode(enrollment.id, existingCheckin.mode, checkinMode);
    await safeSend(zaloUserId,
      `Đã cập nhật: hôm nay bạn tập ${rounds} lượt. Quan trọng là bạn vẫn bước lên thảm 💚`
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

  const workoutDate = todayVN;

  // Ghi check-in
  const { error: checkinError } = await service
    .from('daily_checkins')
    .insert({
      enrollment_id: enrollment.id,
      user_id: profile.id,
      cohort_id: enrollment.cohort_id ?? null,
      day_number: dayNumber,
      workout_date: workoutDate,
      mode: checkinMode,
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
    total_hard_days: checkinMode === 'hard' ? prev.total_hard_days + 1 : prev.total_hard_days,
    total_light_days: checkinMode === 'light' ? prev.total_light_days + 1 : prev.total_light_days,
    total_recovery_days: prev.total_recovery_days,
    total_easy_days: checkinMode === 'easy' ? (prev.total_easy_days ?? 0) + 1 : (prev.total_easy_days ?? 0),
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

  // Ngày cuối trial (D3) — gửi tin trial complete + invite Y.
  // Cron rescue-check vẫn đảm nhiệm chuyển status 'trial' → 'trial_completed';
  // ở đây chỉ phản hồi check-in, không tự đổi status.
  const isTrial = enrollment.status === 'trial';
  if (isTrial && dayNumber >= 3) {
    await safeSend(zaloUserId,
      '💪 Tuyệt vời! Bạn đã hoàn thành 3 ngày trải nghiệm thử!\n\nBạn có muốn đăng ký tập chính thức không? Nhắn Y nếu muốn đăng ký.'
    );
    return;
  }

  await safeSend(zaloUserId, CHECKIN_RESPONSES[rounds]);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ĐIỀU CHỈNH BREAKDOWN STREAK KHI ĐỔI MODE (latest-wins)
// Tổng ngày hoàn thành không đổi (vẫn 1 ngày), chỉ dịch hard/light/easy.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function adjustStreakMode(enrollmentId: string, oldMode: string, newMode: string) {
  if (oldMode === newMode) return;
  const { data: streak } = await service
    .from('streaks')
    .select('total_hard_days, total_light_days, total_easy_days')
    .eq('enrollment_id', enrollmentId)
    .maybeSingle();
  if (!streak) return;

  const col = (mode: string) =>
    mode === 'hard' ? 'total_hard_days' : mode === 'light' ? 'total_light_days' : 'total_easy_days';
  const counts: Record<string, number> = {
    total_hard_days: streak.total_hard_days ?? 0,
    total_light_days: streak.total_light_days ?? 0,
    total_easy_days: streak.total_easy_days ?? 0,
  };
  counts[col(oldMode)] = Math.max(0, counts[col(oldMode)] - 1);
  counts[col(newMode)] = counts[col(newMode)] + 1;

  await service
    .from('streaks')
    .update({ ...counts, updated_at: new Date().toISOString() })
    .eq('enrollment_id', enrollmentId);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// XỬ LÝ CHECK-IN TRIAL (ghi trial_activities, KHÔNG ghi daily_checkins)
// User trial nhắn 1/2/3 → log complete_trial_day {rounds, day_number}.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleTrialCheckin(
  zaloUserId: string,
  profile: any,
  enrollment: any,
  rounds: 1 | 2 | 3,
  safeSend: (uid: string, text: string) => Promise<void>,
) {
  const todayVN = getVietnamDateString();

  // Trial day_number = số ngày lịch từ anchor (giống tin nhắn sáng).
  const anchor = getTrialMorningAnchorDate(
    profile.bodix_start_date,
    enrollment.enrolled_at ?? enrollment.created_at,
  );
  let dayNumber = calendarDaysBetween(anchor, todayVN) + 1;

  // F1: trial chưa bắt đầu (day < 1) → báo ngày bắt đầu, không ghi.
  if (dayNumber < 1) {
    await safeSend(zaloUserId,
      `Trải nghiệm thử của bạn sẽ bắt đầu vào ${formatDateVn(anchor)}. Hẹn gặp bạn khi đó nhé!`
    );
    return;
  }
  // F2: quá D3 nhưng trial_ends_at còn hạn → cap day_number = 3, vẫn cho ghi.
  if (dayNumber > TRIAL_DAYS) dayNumber = TRIAL_DAYS;

  // Dedup theo ngày VN + day_number: lấy các complete_trial_day của user, lọc trong code
  // (metadata->>day_number và DATE(created_at AT TIME ZONE VN) = todayVN).
  const { data: rows } = await service
    .from('trial_activities')
    .select('id, metadata, created_at')
    .eq('user_id', profile.id)
    .eq('activity_type', 'complete_trial_day')
    .order('created_at', { ascending: false });

  const existing = (rows ?? []).find(
    (r: any) =>
      String(r.metadata?.day_number) === String(dayNumber) &&
      isoTimestampToVietnamYmd(r.created_at) === todayVN,
  );

  if (existing) {
    const existingRounds = Number(existing.metadata?.rounds);
    // Cùng số lượt → đã ghi rồi.
    if (existingRounds === rounds) {
      await safeSend(zaloUserId, 'Bạn đã ghi nhận tập hôm nay rồi. Hẹn gặp lại ngày mai nhé!');
      return;
    }
    // Số lượt KHÁC → latest-wins: cập nhật metadata.rounds.
    await service
      .from('trial_activities')
      .update({ metadata: { ...existing.metadata, rounds, day_number: dayNumber } })
      .eq('id', existing.id);
    await safeSend(zaloUserId,
      `Đã cập nhật: hôm nay bạn tập ${rounds} lượt. Quan trọng là bạn vẫn bước lên thảm 💚`
    );
    return;
  }

  // Chưa có → INSERT.
  const { error: insertError } = await service.from('trial_activities').insert({
    user_id: profile.id,
    program_id: enrollment.program_id,
    activity_type: 'complete_trial_day',
    metadata: { rounds, day_number: dayNumber },
  });

  if (insertError) {
    console.error('[zalo/webhook] insert trial_activities:', insertError);
    await safeSend(zaloUserId, 'Có lỗi xảy ra. Vui lòng thử lại sau.');
    return;
  }

  await safeSend(zaloUserId, CHECKIN_RESPONSES[rounds]);
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

  // KHÔNG .single() — throw khi >1 profile trùng channel_user_id.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('channel_user_id', String(zaloUserId ?? '').trim())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

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
