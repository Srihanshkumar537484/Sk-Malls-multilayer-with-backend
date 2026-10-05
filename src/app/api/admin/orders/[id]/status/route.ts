import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit/log';
import { ADMIN_ALL_STATUSES } from '@/lib/orders/status';
import { applyOrderStatusSideEffects } from '@/lib/orders/apply-status-side-effects';

const bodySchema = z.object({
  status: z.enum(ADMIN_ALL_STATUSES as [string, ...string[]]),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Admins only.' }, { status: 403 });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { data: subOrder } = await supabase.from('seller_orders').select('id, status').eq('id', params.id).maybeSingle();
  if (!subOrder) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });

  const { error } = await supabase.from('seller_orders').update({ status: parsed.data.status }).eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await applyOrderStatusSideEffects(supabase, params.id, parsed.data.status);
  await writeAuditLog(supabase, {
    actorId: user.id,
    action: 'seller_order.admin_status_changed',
    table: 'seller_orders',
    recordId: params.id,
    oldValue: { status: subOrder.status },
    newValue: { status: parsed.data.status },
  });

  return NextResponse.json({ ok: true, status: parsed.data.status });
}
