import { requireAdmin } from '@/lib/auth/guards';
import { StatusActionButton } from '@/components/admin/StatusActionButton';

export default async function AdminReviewsPage() {
  const { supabase } = await requireAdmin();

  const { data: reviews } = await supabase
    .from('reviews')
    .select('id, rating, comment, is_verified_purchase, created_at, products ( name ), profiles ( full_name )')
    .eq('is_approved', false)
    .order('created_at', { ascending: false });

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-6">Pending reviews</h1>

      {(reviews ?? []).length === 0 ? (
        <p className="text-gray-600">Nothing to moderate.</p>
      ) : (
        <div className="space-y-4">
          {(reviews ?? []).map((review: any) => (
            <div key={review.id} className="rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold">{review.products?.name}</p>
                <span className="text-sm">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
              </div>
              <p className="text-xs text-gray-500 mb-2">
                {review.profiles?.full_name ?? 'Customer'}
                {review.is_verified_purchase && ' · Verified purchase'}
              </p>
              {review.comment && <p className="text-sm text-gray-700 mb-3">{review.comment}</p>}
              <div className="space-x-2">
                <StatusActionButton endpoint={`/api/admin/reviews/${review.id}/status`} action="approve" label="Approve" />
                <StatusActionButton endpoint={`/api/admin/reviews/${review.id}/status`} action="reject" label="Reject" variant="danger" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
