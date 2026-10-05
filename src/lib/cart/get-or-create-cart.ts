import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Returns the logged-in customer's cart id, creating one if it doesn't
 * exist yet. Scoped to profile_id — RLS (carts_own policy) already
 * guarantees a user can only ever reach their own cart, this just avoids
 * a second round trip on every request.
 *
 * NOTE: guest (non-logged-in) checkout from the master spec isn't wired up
 * yet — carts.session_id exists in the schema for that, but the cookie-based
 * guest-cart flow is a follow-up layer. For now /cart and /checkout require
 * login.
 */
export async function getOrCreateCartId(supabase: SupabaseClient, profileId: string): Promise<string> {
  const { data: existing } = await supabase.from('carts').select('id').eq('profile_id', profileId).maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from('carts')
    .insert({ profile_id: profileId })
    .select('id')
    .single();

  if (error || !created) {
    throw new Error(error?.message ?? 'Could not create cart.');
  }

  return created.id;
}
