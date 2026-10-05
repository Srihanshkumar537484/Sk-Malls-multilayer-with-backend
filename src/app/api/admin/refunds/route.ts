import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit/log';

const bodySchema = z.object({
  return_id: z.string().uuid(),
  amount: z.coerce.number().positive(),
  reason: z.string().optional(),
});

export async function POST(request: Request) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'super_admin') return NextResponse.json({ error: 'Admins only.' }, { status: 403 });

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data: ret } = await supabase
    .from('returns')
    .select('id, status, seller_orders ( order_id, seller_id )')
    .eq('id', parsed.data.return_id)
    .maybeSingle();

  if (!ret) return NextResponse.json({ error: 'Return not found.' }, { status: 404 });
  if (ret.status !== 'approved') {
    return NextResponse.json({ error: 'Only approved returns can be refunded.' }, { status: 409 });
  }

  const subOrder = (ret as any).seller_orders;

  const { data: refund, error } = await supabase
    .from('refunds')
    .insert({
      return_id: ret.id,
      order_id: subOrder.order_id,
      seller_id: subOrder.seller_id,
      amount: parsed.data.amount,
      reason: parsed.data.reason,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog(supabase, {
    actorId: user.id,
    action: 'refund.created',
    table: 'refunds',
    recordId: refund.id,
    newValue: { amount: parsed.data.amount },
  });

  return NextResponse.json({ id: refund.id }, { status: 201 });
}
