import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client với service_role_key cho server-side operations.
 * Bypass RLS. Chỉ dùng trong API routes, cron, Edge Functions.
 * NEVER expose to the client.
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
