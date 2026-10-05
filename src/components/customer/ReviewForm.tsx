'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ReviewForm({ productId, orderItemId }: { productId: string; orderItemId: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: productId,
        order_item_id: orderItemId,
        rating,
        comment: formData.get('comment'),
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(typeof body.error === 'string' ? body.error : 'Could not submit review.');
      return;
    }

    setSubmitted(true);
    router.refresh();
  }

  if (submitted) {
    return <p className="text-sm text-green-700">Thanks — your review will appear once an admin approves it.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 p-4 max-w-md">
      <p className="text-sm font-medium text-gray-900 mb-2">Leave a review</p>
      <div className="flex gap-1 mb-3">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => setRating(n)} className="text-xl leading-none">
            {n <= rating ? '★' : '☆'}
          </button>
        ))}
      </div>
      <textarea
        name="comment"
        rows={3}
        placeholder="What did you think?"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm mb-3"
      />
      {error && <p role="alert" className="text-sm text-red-600 mb-2">{error}</p>}
      <button type="submit" disabled={submitting} className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {submitting ? 'Submitting…' : 'Submit review'}
      </button>
    </form>
  );
}
