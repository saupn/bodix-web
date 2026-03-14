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

  // Lấy refresh token hiện tại
  const { data: tokenRow } = await supabase
    .from('zalo_tokens').select('*').eq('id', 1).single();

  if (!tokenRow) {
    return NextResponse.json({ error: 'No token found' }, { status: 500 });
  }

  // Gọi Zalo refresh
  const res = await fetch('https://oauth.zaloapp.com/v4/oa/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'secret_key': process.env.ZALO_APP_SECRET!,
    },
    body: new URLSearchParams({
      app_id: process.env.ZALO_APP_ID!,
      refresh_token: tokenRow.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const data = await res.json();

  if (data.access_token) {
    await supabase.from('zalo_tokens').update({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', 1);

    return NextResponse.json({ success: true, expires_at: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString() });
  }

  console.error('Token refresh failed:', data);
  return NextResponse.json({ error: 'Refresh failed', details: data }, { status: 500 });
}