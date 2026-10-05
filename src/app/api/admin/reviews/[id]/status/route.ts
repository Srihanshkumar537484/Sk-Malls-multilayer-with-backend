import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit/log';

const bodySchema = z.object({ action: z.enum(['approve', 'reject']) });

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'super_admin') return NextResponse.json({ error: 'Admins only.' }, { status: 403 });

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  if (parsed.data.action === 'approve') {
    const { error } = await supabase.from('reviews').update({ is_approved: true }).eq('id', params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    // Rejecting a review deletes it outright — spec says "never create fake
    // reviews" and gives admin moderation, but keeping visibly-rejected
    // reviews around serves no purpose once moderated out.
    const { error } = await supabase.from('reviews').delete().eq('id', params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await writeAuditLog(supabase, {
    actorId: user.id,
    action: `review.${parsed.data.action}`,
    table: 'reviews',
    recordId: params.id,
  });

  return NextResponse.json({ ok: true });
}
