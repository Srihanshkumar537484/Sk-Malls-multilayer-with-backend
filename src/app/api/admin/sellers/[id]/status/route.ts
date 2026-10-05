import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit/log';

const bodySchema = z.object({
  action: z.enum(['approve', 'reject', 'suspend', 'reactivate']),
  rejection_reason: z.string().optional(),
});

const ACTION_TO_STATUS: Record<string, string> = {
  approve: 'approved',
  reject: 'rejected',
  suspend: 'suspended',
  reactivate: 'approved',
};

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

  const { data: seller } = await supabase.from('sellers').select('*').eq('id', params.id).maybeSingle();
  if (!seller) return NextResponse.json({ error: 'Seller not found.' }, { status: 404 });

  const newStatus = ACTION_TO_STATUS[parsed.data.action];

  const { error } = await supabase
    .from('sellers')
    .update({
      status: newStatus,
      rejection_reason: parsed.data.action === 'reject' ? parsed.data.rejection_reason ?? null : seller.rejection_reason,
    })
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog(supabase, {
    actorId: user.id,
    action: `seller.${parsed.data.action}`,
    table: 'sellers',
    recordId: params.id,
    oldValue: { status: seller.status },
    newValue: { status: newStatus },
  });

  // Approving a seller also creates their public store, if they don't have one yet.
  if (parsed.data.action === 'approve') {
    const { data: existingStore } = await supabase.from('stores').select('id').eq('seller_id', params.id).maybeSingle();
    if (!existingStore) {
      const baseSlug = seller.business_name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      await supabase.from('stores').insert({
        seller_id: params.id,
        slug: `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`,
        name: seller.business_name,
        description: seller.shop_description,
        logo_url: seller.logo_url,
      });
    }
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
