import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit/log';
import { SELLER_ALLOWED_TRANSITIONS } from '@/lib/orders/status';
import { applyOrderStatusSideEffects } from '@/lib/orders/apply-status-side-effects';

const bodySchema = z.object({
  status: z.string(),
  tracking_number: z.string().optional(),
  tracking_notes: z.string().optional(),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });

  const { data: seller } = await supabase.from('sellers').select('id').eq('profile_id', user.id).maybeSingle();
  if (!seller) return NextResponse.json({ error: 'Not a seller.' }, { status: 403 });

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // RLS already scopes this to the caller's own seller_orders, but we
  // re-check ownership explicitly to give a clear error message.
  const { data: subOrder } = await supabase
    .from('seller_orders')
    .select('id, seller_id, status')
    .eq('id', params.id)
    .maybeSingle();

  if (!subOrder || subOrder.seller_id !== seller.id) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }

  const allowed = SELLER_ALLOWED_TRANSITIONS[subOrder.status] ?? [];
  if (!allowed.includes(parsed.data.status)) {
    return NextResponse.json(
      { error: `Cannot move an order from "${subOrder.status}" to "${parsed.data.status}".` },
      { status: 409 }
    );
  }

  const { error } = await supabase
    .from('seller_orders')
    .update({
      status: parsed.data.status,
      tracking_number: parsed.data.tracking_number,
      tracking_notes: parsed.data.tracking_notes,
    })
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await applyOrderStatusSideEffects(supabase, params.id, parsed.data.status);
  await writeAuditLog(supabase, {
    actorId: user.id,
    action: 'seller_order.status_changed',
    table: 'seller_orders',
    recordId: params.id,
    oldValue: { status: subOrder.status },
    newValue: { status: parsed.data.status },
  });

  return NextResponse.json({ ok: true, status: parsed.data.status });
}
