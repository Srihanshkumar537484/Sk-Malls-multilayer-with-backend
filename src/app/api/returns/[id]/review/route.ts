import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit/log';

const bodySchema = z.object({
  approve: z.boolean(),
  notes: z.string().optional(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'You must be logged in.' }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // review_return() itself checks the caller is the owning seller or an
  // admin (RLS on the tables it touches would block an unauthorized write
  // anyway, since the function runs as SECURITY DEFINER but re-derives
  // auth.uid() internally rather than trusting the caller).
  const { error } = await supabase.rpc('review_return', {
    p_return_id: params.id,
    p_approve: parsed.data.approve,
    p_notes: parsed.data.notes ?? null,
  });

  if (error) {
    const known: Record<string, string> = {
      RETURN_NOT_FOUND: 'Return not found.',
      NOT_AUTHORIZED: 'You are not authorized to review this return.',
    };
    const message = Object.keys(known).find((key) => error.message.includes(key));
    return NextResponse.json({ error: message ? known[message] : 'Could not update the return.' }, { status: 409 });
  }

  await writeAuditLog(supabase, {
    actorId: user.id,
    action: parsed.data.approve ? 'return.approved' : 'return.rejected',
    table: 'returns',
    recordId: params.id,
  });

  return NextResponse.json({ ok: true });
}
