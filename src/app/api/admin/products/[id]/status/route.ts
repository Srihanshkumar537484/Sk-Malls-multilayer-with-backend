import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { writeAuditLog } from '@/lib/audit/log';

const bodySchema = z.object({
  action: z.enum(['approve', 'reject', 'unpublish', 'request_changes']),
  rejection_reason: z.string().optional(),
});

const ACTION_TO_STATUS: Record<string, string> = {
  approve: 'approved',
  reject: 'rejected',
  unpublish: 'unpublished',
  request_changes: 'draft',
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

  const { data: product } = await supabase.from('products').select('id, status').eq('id', params.id).maybeSingle();
  if (!product) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });

  const newStatus = ACTION_TO_STATUS[parsed.data.action];

  const { error } = await supabase
    .from('products')
    .update({
      status: newStatus,
      rejection_reason: parsed.data.action === 'reject' ? parsed.data.rejection_reason ?? null : null,
    })
    .eq('id', params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await writeAuditLog(supabase, {
    actorId: user.id,
    action: `product.${parsed.data.action}`,
    table: 'products',
    recordId: params.id,
    oldValue: { status: product.status },
    newValue: { status: newStatus },
  });

  return NextResponse.json({ ok: true, status: newStatus });
}
