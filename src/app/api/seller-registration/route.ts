import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { sellerRegistrationSchema } from '@/lib/validation/seller';

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'You must be logged in to register as a seller.' }, { status: 401 });
  }

  const body = await request.json();
  const parsed = sellerRegistrationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Server-side re-check: one seller application per profile.
  const { data: existing } = await supabase
    .from('sellers')
    .select('id, status')
    .eq('profile_id', user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: `You already have a seller application (status: ${existing.status}).` },
      { status: 409 }
    );
  }

  const { data: seller, error } = await supabase
    .from('sellers')
    .insert({
      profile_id: user.id,
      ...parsed.data,
      status: 'pending',
    })
    .select('id, status')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ seller }, { status: 201 });
}
