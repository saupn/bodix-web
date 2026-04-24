import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data } = await supabase.from('zalo_tokens').select('expires_at').eq('id', 1).single();
  const expiresAt = new Date(data?.expires_at);
  const now = new Date();
  return NextResponse.json({
    token_expires_at: data?.expires_at,
    is_expired: expiresAt < now,
    hours_remaining: ((expiresAt.getTime() - now.getTime()) / 3600000).toFixed(1),
  });
}
