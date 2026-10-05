import { requireAdmin } from '@/lib/auth/guards';
import { ReturnReviewButtons } from '@/components/admin/ReturnReviewButtons';
import { CreateRefundButton, ProcessRefundButton } from '@/components/admin/RefundButtons';

export default async function AdminReturnsPage() {
  const { supabase } = await requireAdmin();

  const { data: requestedReturns } = await supabase
    .from('returns')
    .select(
      `id, reason, status, created_at,
       order_items ( product_name_snapshot, unit_price, quantity ),
       seller_orders ( sub_order_number, sellers ( business_name ) )`
    )
    .eq('status', 'requested')
    .order('created_at', { ascending: false });

  const { data: approvedReturns } = await supabase
    .from('returns')
    .select(
      `id, created_at,
       order_items ( product_name_snapshot, unit_price, quantity ),
       seller_orders ( sub_order_number, sellers ( business_name ) ),
       refunds ( id, status )`
    )
    .eq('status', 'approved')
    .order('created_at', { ascending: false });

  const { data: pendingRefunds } = await supabase
    .from('refunds')
    .select('id, amount, reason, created_at, order_id')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-2xl font-bold mb-4">Return requests</h1>
        {(requestedReturns ?? []).length === 0 ? (
          <p className="text-gray-600">No pending return requests.</p>
        ) : (
          <div className="space-y-3">
            {(requestedReturns ?? []).map((r: any) => (
              <div key={r.id} className="rounded-lg border border-gray-200 p-4 flex items-center justify-between">
                <div className="text-sm">
                  <p className="font-medium">{r.order_items?.product_name_snapshot}</p>
                  <p className="text-gray-500">{r.seller_orders?.sub_order_number} · {r.seller_orders?.sellers?.business_name}</p>
                  <p className="text-gray-600 mt-1">Reason: {r.reason}</p>
                </div>
                <ReturnReviewButtons returnId={r.id} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-display text-xl font-semibold mb-4">Approved returns awaiting refund</h2>
        {(approvedReturns ?? []).filter((r: any) => (r.refunds ?? []).length === 0).length === 0 ? (
          <p className="text-gray-600">Nothing waiting on a refund.</p>
        ) : (
          <div className="space-y-3">
            {(approvedReturns ?? [])
              .filter((r: any) => (r.refunds ?? []).length === 0)
              .map((r: any) => (
                <div key={r.id} className="rounded-lg border border-gray-200 p-4 flex items-center justify-between">
                  <div className="text-sm">
                    <p className="font-medium">{r.order_items?.product_name_snapshot}</p>
                    <p className="text-gray-500">{r.seller_orders?.sub_order_number} · {r.seller_orders?.sellers?.business_name}</p>
                  </div>
                  <CreateRefundButton
                    returnId={r.id}
                    suggestedAmount={(r.order_items?.unit_price ?? 0) * (r.order_items?.quantity ?? 1)}
                  />
                </div>
              ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="font-display text-xl font-semibold mb-4">Pending refunds</h2>
        {(pendingRefunds ?? []).length === 0 ? (
          <p className="text-gray-600">No refunds pending.</p>
        ) : (
          <div className="space-y-3">
            {(pendingRefunds ?? []).map((refund) => (
              <div key={refund.id} className="rounded-lg border border-gray-200 p-4 flex items-center justify-between">
                <p className="text-sm">₹{refund.amount} — {refund.reason ?? 'No reason given'}</p>
                <ProcessRefundButton refundId={refund.id} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
