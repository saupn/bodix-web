import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  // Bảo mật: chỉ pg_cron hoặc admin mới gọi được
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Lấy access token
  const { data: tokenRow } = await supabase
    .from('zalo_tokens')
    .select('access_token')
    .eq('id', 1)
    .single();

  if (!tokenRow?.access_token) {
    return NextResponse.json({ error: 'No token' }, { status: 500 });
  }

  // Lấy users active, chưa vượt ngày 21
  const { data: users } = await supabase
    .from('users')
    .select('id, name, zalo_user_id, bodix_current_day, bodix_last_checkin')
    .eq('bodix_status', 'active')
    .not('zalo_user_id', 'is', null)
    .lte('bodix_current_day', 21);

  if (!users || users.length === 0) {
    return NextResponse.json({ sent: 0, message: 'No active users' });
  }

  // Lấy tất cả program_days 1 lần (tránh query N lần)
  const { data: allDays } = await supabase
    .from('program_days')
    .select('*');

  const dayMap = new Map(allDays?.map(d => [d.day_number, d]) || []);

  let sentCount = 0;
  let errorCount = 0;

  for (const user of users) {
    const day = user.bodix_current_day || 1;
    const dayContent = dayMap.get(day);

    if (!dayContent || !user.zalo_user_id) continue;

    // Soạn tin nhắn
    const text =
      `${dayContent.morning_message}\n\n` +
      `🔥 Hard (3 lượt): ${dayContent.video_link_hard}\n` +
      `💪 Light (2 lượt): ${dayContent.video_link_light}\n` +
      `✅ Easy (1 lượt): ${dayContent.video_link_easy}\n\n` +
      `Tập xong reply: HARD / LIGHT / EASY`;

    try {
      const res = await fetch('https://openapi.zalo.me/v3.0/oa/message/cs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': tokenRow.access_token,
        },
        body: JSON.stringify({
          recipient: { user_id: user.zalo_user_id },
          message: { text },
        }),
      });

      const result = await res.json();

      if (result.error === 0) {
        sentCount++;
      } else {
        console.error(`Failed for user ${user.id}:`, result);
        errorCount++;
      }
    } catch (err) {
      console.error(`Error sending to user ${user.id}:`, err);
      errorCount++;
    }

    // Rate limiting: 100ms giữa mỗi tin (Zalo cho phép 10 req/giây)
    await new Promise(r => setTimeout(r, 100));
  }

  return NextResponse.json({ sent: sentCount, errors: errorCount, total: users.length });
}