import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit/log';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not logged in.' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'super_admin') return NextResponse.json({ error: 'Admins only.' }, { status: 403 });

  const { reference } = await request.json().catch(() => ({ reference: undefined }));

  const { data: refund } = await supabase.from('refunds').select('*').eq('id', params.id).maybeSingle();
  if (!refund) return NextResponse.json({ error: 'Refund not found.' }, { status: 404 });
  if (refund.status === 'processed') {
    return NextResponse.json({ error: 'This refund was already processed.' }, { status: 409 });
  }

  const { error } = await supabase
    .from('refunds')
    .update({ status: 'processed', reference: reference ?? null, processed_at: new Date().toISOString() })
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Debit the seller's ledger for the refunded amount — this is what
  // actually reduces their available/pending earnings for this sale.
  if (refund.seller_id) {
    await supabase.from('seller_ledger').insert({
      seller_id: refund.seller_id,
      type: 'refund',
      amount: -refund.amount,
      status: 'posted',
      description: `Refund processed for order ${refund.order_id}`,
    });
  }

  // Note: refund.return_id links back to the originating return for
  // reference — the return's own status was already finalized by
  // review_return() when it was approved, so nothing further to update here.

  await writeAuditLog(supabase, {
    actorId: user.id,
    action: 'refund.processed',
    table: 'refunds',
    recordId: params.id,
    newValue: { reference },
  });

  return NextResponse.json({ ok: true });
}
