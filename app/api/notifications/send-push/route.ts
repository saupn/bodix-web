import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { sendFcmMessage } from '@/lib/messaging/adapters/push';

interface PushApiPayload {
  user_id?: string;
  user_ids?: string[];
  type: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

interface ProfileRow {
  id: string;
  fcm_token: string | null;
  notification_via: string | null;
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let payload: PushApiPayload;
  try {
    payload = (await request.json()) as PushApiPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!payload.type || !payload.title || !payload.body) {
    return NextResponse.json(
      { error: 'Missing type, title, or body' },
      { status: 400 },
    );
  }
  if (!payload.user_id && !payload.user_ids?.length) {
    return NextResponse.json(
      { error: 'Missing user_id or user_ids' },
      { status: 400 },
    );
  }

  let query = supabaseAdmin
    .from('profiles')
    .select('id, fcm_token, notification_via');

  if (payload.user_id) {
    query = query.eq('id', payload.user_id);
  } else if (payload.user_ids) {
    query = query.in('id', payload.user_ids);
  }
  query = query.not('fcm_token', 'is', null);

  const { data: users, error } = await query;
  if (error) {
    return NextResponse.json(
      { sent: 0, error: error.message },
      { status: 500 },
    );
  }
  if (!users?.length) {
    return NextResponse.json({ sent: 0, errors: 0, total: 0 });
  }

  // App users chỉ có 'push' hoặc 'none'. KHÔNG check 'both'.
  const eligibleUsers = (users as ProfileRow[]).filter(
    (u) => u.notification_via === 'push' && u.fcm_token,
  );

  if (!eligibleUsers.length) {
    return NextResponse.json({ sent: 0, errors: 0, total: 0 });
  }

  let sent = 0;
  let errors = 0;

  for (const user of eligibleUsers) {
    const result = await sendFcmMessage(
      user.fcm_token!,
      {
        type: payload.type,
        title: payload.title,
        body: payload.body,
        data: payload.data,
      },
      user.id,
    );
    if (result.success) {
      sent++;
    } else {
      errors++;
    }
  }

  return NextResponse.json({ sent, errors, total: eligibleUsers.length });
}
