import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN HANDLER — Zalo POST webhook đến đây
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    // Verify nguồn gốc
    if (payload.app_id !== process.env.ZALO_APP_ID) {
      console.error('Invalid app_id:', payload.app_id);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Xử lý theo loại sự kiện
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
function parseCheckinType(text: string): string | null {
  const t = text.trim().toUpperCase();

  // Thứ tự ưu tiên: hard → light → easy
  const hard  = ['HARD', 'H', '3', 'FULL', 'DONE', 'XONG', '✅', 'DA TAP'];
  const light = ['LIGHT', 'L', '2', 'NHE'];
  const easy  = ['EASY', 'E', '1', 'DE', 'OK'];

  if (hard.some(k => t === k || t.startsWith(k + ' '))) return 'hard';
  if (light.some(k => t === k || t.startsWith(k + ' '))) return 'light';
  if (easy.some(k => t === k || t.startsWith(k + ' '))) return 'easy';

  // Fallback: check nếu text chứa keyword
  if (hard.some(k => t.includes(k))) return 'hard';
  if (light.some(k => t.includes(k))) return 'light';
  if (easy.some(k => t.includes(k))) return 'easy';

  return null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// XỬ LÝ CHECK-IN
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function handleUserMessage(payload: any) {
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

  // Lấy user từ DB
  const { data: user, error } = await supabase
    .from('users')
    .select('id, name, bodix_current_day, bodix_streak, bodix_total_hard, bodix_total_light, bodix_total_easy, bodix_status')
    .eq('zalo_user_id', zaloUserId)
    .single();

  if (error || !user) {
    await sendZaloMessage(zaloUserId,
      'Mình chưa tìm thấy tài khoản của bạn. Vui lòng đăng ký tại bodix.fit trước nhé!'
    );
    return;
  }

  if (user.bodix_status !== 'active') {
    await sendZaloMessage(zaloUserId,
      'Tài khoản của bạn chưa kích hoạt. Vui lòng liên hệ hỗ trợ.'
    );
    return;
  }

  const dayNumber = user.bodix_current_day || 1;

  // Kiểm tra đã check-in ngày này chưa
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data: existing } = await supabase
    .from('checkins')
    .select('id')
    .eq('zalo_user_id', zaloUserId)
    .eq('day_number', dayNumber)
    .gte('created_at', todayStart.toISOString())
    .limit(1);

  if (existing && existing.length > 0) {
    await sendZaloMessage(zaloUserId,
      `Bạn đã check-in ngày ${dayNumber} rồi! Nghỉ ngơi và hẹn ngày mai nhé 💪`
    );
    return;
  }

  // Ghi check-in
  await supabase.from('checkins').insert({
    user_id: user.id,
    zalo_user_id: zaloUserId,
    day_number: dayNumber,
    checkin_type: checkinType,
    source: 'webhook',
    message_raw: messageText,
  });

  // Cập nhật user — Cả 3 mức đều = Done → streak luôn +1
  const newStreak = (user.bodix_streak || 0) + 1;
  const updates: any = {
    bodix_current_day: dayNumber + 1,
    bodix_last_checkin: new Date().toISOString(),
    bodix_streak: newStreak,
  };

  if (checkinType === 'hard') updates.bodix_total_hard = (user.bodix_total_hard || 0) + 1;
  if (checkinType === 'light') updates.bodix_total_light = (user.bodix_total_light || 0) + 1;
  if (checkinType === 'easy') updates.bodix_total_easy = (user.bodix_total_easy || 0) + 1;

  if (dayNumber >= 21) updates.bodix_status = 'completed';

  await supabase.from('users').update(updates).eq('id', user.id);

  // Gửi phản hồi
  const emojis: Record<string, string> = { hard: '🔥', light: '💪', easy: '✅' };
  const labels: Record<string, string> = { hard: '3 lượt', light: '2 lượt', easy: '1 lượt' };

  await sendZaloMessage(zaloUserId,
    `${emojis[checkinType]} Ngày ${dayNumber}/21 hoàn thành (${labels[checkinType]})! Streak: ${newStreak} ngày`
  );

  // Nếu hoàn thành D21
  if (dayNumber >= 21) {
    const totalDone = (updates.bodix_total_hard || user.bodix_total_hard || 0)
                    + (updates.bodix_total_light || user.bodix_total_light || 0)
                    + (updates.bodix_total_easy || user.bodix_total_easy || 0);
    await sendZaloMessage(zaloUserId,
      `🏆 CHÚC MỪNG! Bạn đã hoàn thành BodiX 21!\n` +
      `Tổng ${totalDone} buổi: ${updates.bodix_total_hard || user.bodix_total_hard || 0} Hard + ` +
      `${updates.bodix_total_light || user.bodix_total_light || 0} Light + ` +
      `${updates.bodix_total_easy || user.bodix_total_easy || 0} Easy\n` +
      `Bạn là người hoàn thành. Tự hào về bản thân!`
    );
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FOLLOW / UNFOLLOW
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function handleFollow(payload: any) {
  const zaloUserId = payload.follower?.id || payload.user_id_by_app;
  if (!zaloUserId) return;

  console.log('New follower:', zaloUserId);

  // Lưu UID vào users (upsert — nếu chưa có thì tạo, có rồi thì cập nhật)
  await supabase.from('users').upsert({
    zalo_user_id: zaloUserId,
    bodix_status: 'pending_registration',
  }, { onConflict: 'zalo_user_id' });

  // Gửi tin chào mừng
  await sendZaloMessage(zaloUserId,
    'Chào mừng bạn đến với BodiX! 💪\n\n' +
    'Để bắt đầu hành trình 21 ngày, đăng ký tại bodix.fit nhé.\n' +
    'Sau khi đăng ký, bạn sẽ nhận tin nhắc tập mỗi sáng 6:30.'
  );
}

async function handleUnfollow(payload: any) {
  const zaloUserId = payload.follower?.id || payload.user_id_by_app;
  if (!zaloUserId) return;

  await supabase
    .from('users')
    .update({ bodix_status: 'dropped' })
    .eq('zalo_user_id', zaloUserId);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GỬI TIN NHẮN QUA ZALO OA API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function sendZaloMessage(userId: string, text: string) {
  // Lấy access token từ DB
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