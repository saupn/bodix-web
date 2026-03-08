import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Supabase client với service_role key — bypass RLS.
 * Dùng trong Edge Functions. KHÔNG expose ra client-side.
 */
export function createAdminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}
