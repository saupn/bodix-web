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

  console.log('[send-push] Firebase project:', process.env.FIREBASE_PROJECT_ID);
  console.log(
    '[send-push] Firebase email:',
    process.env.FIREBASE_CLIENT_EMAIL?.substring(0, 20) + '...',
  );
  console.log(
    '[send-push] Private key exists:',
    !!process.env.FIREBASE_PRIVATE_KEY,
  );

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

  const eligibleUsers = (users as ProfileRow[]).filter(
    (u) =>
      (u.notification_via === 'push' || u.notification_via === 'both') &&
      u.fcm_token,
  );

  if (!eligibleUsers.length) {
    return NextResponse.json({ sent: 0, errors: 0, total: 0 });
  }

  let sent = 0;
  let errors = 0;
  const errorDetails: Array<{ user_id: string; error: string }> = [];

  for (const user of eligibleUsers) {
    const user_id = user.id;
    const result = await sendFcmMessage(
      user.fcm_token!,
      {
        type: payload.type,
        title: payload.title,
        body: payload.body,
        data: payload.data,
      },
      user_id,
    );
    if (result.success) {
      sent++;
    } else {
      errors++;
      const error = result.error;
      console.error('[send-push] FCM error for user', user_id, ':', error);
      errorDetails.push({
        user_id,
        error: error ?? 'unknown_error',
      });
    }
  }

  return NextResponse.json({
    sent,
    errors,
    total: eligibleUsers.length,
    error_details: errorDetails,
  });
}
