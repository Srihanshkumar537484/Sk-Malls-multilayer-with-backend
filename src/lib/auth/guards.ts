import { redirect } from 'next/navigation';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * Fetches the logged-in user's profile. Redirects to /login if not
 * authenticated. This is a convenience for pages — middleware already
 * redirects wrong-role users away from gated routes, but pages still need
 * the actual profile/seller data to render.
 */
export async function requireProfile() {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile) redirect('/login');

  return { supabase, user, profile };
}

/** Redirects home if the logged-in user isn't an approved seller. Returns their seller row. */
export async function requireApprovedSeller() {
  const { supabase, user, profile } = await requireProfile();
  if (profile.role !== 'seller') redirect('/');

  const { data: seller } = await supabase.from('sellers').select('*').eq('profile_id', user.id).single();
  if (!seller || seller.status !== 'approved') redirect('/seller/register');

  return { supabase, user, profile, seller };
}

/** Redirects home if the logged-in user isn't super_admin. */
export async function requireAdmin() {
  const { supabase, user, profile } = await requireProfile();
  if (profile.role !== 'super_admin') redirect('/');
  return { supabase, user, profile };
}
