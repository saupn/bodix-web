import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: tokenRow } = await supabase
    .from('zalo_tokens').select('access_token').eq('id', 1).single();

  const { data: users } = await supabase
    .from('users')
    .select('id, name, zalo_user_id, zalo_phone, bodix_current_day, bodix_last_checkin')
    .eq('bodix_status', 'active')
    .not('zalo_user_id', 'is', null);

  if (!users) return NextResponse.json({ rescued: 0 });

  const now = new Date();
  let rescueCount = 0;

  for (const user of users) {
    if (!user.bodix_last_checkin) continue;

    const lastCheckin = new Date(user.bodix_last_checkin);
    const daysMissed = Math.floor((now.getTime() - lastCheckin.getTime()) / (1000 * 60 * 60 * 24));

    if (daysMissed < 2) continue;

    // Đã rescue hôm nay chưa?
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const { data: existingRescue } = await supabase
      .from('rescues')
      .select('id')
      .eq('zalo_user_id', user.zalo_user_id)
      .gte('triggered_at', todayStart.toISOString())
      .limit(1);

    if (existingRescue && existingRescue.length > 0) continue;

    const level = daysMissed === 2 ? 1 : daysMissed === 3 ? 2 : 3;

    // Ghi log rescue
    await supabase.from('rescues').insert({
      user_id: user.id,
      zalo_user_id: user.zalo_user_id,
      level,
      days_missed: daysMissed,
    });

    // Cấp 1–2: gửi tin OA
    if (level <= 2 && user.zalo_user_id) {
      const messages: Record<number, string> = {
        1: `${user.name || 'Bạn'} ơi, mình thấy bạn chưa check-in 2 ngày rồi.\n` +
           `Chỉ cần 1 lượt Easy (~12 phút) là streak vẫn giữ.\n` +
           `Reply EASY khi xong nhé!`,
        2: `${user.name || 'Bạn'} ơi, bạn đã đi được ${(user.bodix_current_day || 1) - 1} ngày rồi.\n` +
           `Mình có thể chuyển bạn sang Easy Mode — chỉ 1 lượt, ~12 phút.\n` +
           `Vẫn tính hoàn thành, streak vẫn giữ!\n` +
           `Reply EASY nếu bạn muốn tiếp tục nhé!`,
      };

      await fetch('https://openapi.zalo.me/v3.0/oa/message/cs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': tokenRow!.access_token,
        },
        body: JSON.stringify({
          recipient: { user_id: user.zalo_user_id },
          message: { text: messages[level] },
        }),
      });
    }

    // Cấp 3: chỉ log — admin/coach gọi điện thủ công
    // Dashboard sẽ hiện alert

    rescueCount++;
    await new Promise(r => setTimeout(r, 100));
  }

  return NextResponse.json({ rescued: rescueCount });
}