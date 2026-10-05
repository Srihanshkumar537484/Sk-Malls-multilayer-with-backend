import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

/**
 * Client-side Supabase client. Uses the public anon key — RLS policies
 * (see supabase/migrations/0005_rls_policies.sql) are what actually keep
 * data safe, not this client. Never use the service role key here.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
