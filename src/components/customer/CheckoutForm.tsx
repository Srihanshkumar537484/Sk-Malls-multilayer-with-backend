'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function CheckoutForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const body = await res.json();
    setSubmitting(false);

    if (!res.ok) {
      setError(typeof body.error === 'string' ? body.error : 'Please check your details and try again.');
      return;
    }

    router.push(`/account/orders/${body.order_id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div>
        <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
        <input id="full_name" name="full_name" required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
        <input id="phone" name="phone" type="tel" required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label htmlFor="line1" className="block text-sm font-medium text-gray-700 mb-1">Address</label>
        <input id="line1" name="line1" required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
      </div>
      <div>
        <label htmlFor="line2" className="block text-sm font-medium text-gray-700 mb-1">Apartment, floor, etc. (optional)</label>
        <input id="line2" name="line2" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">City</label>
          <input id="city" name="city" required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">State</label>
          <input id="state" name="state" required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="pincode" className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
          <input id="pincode" name="pincode" required className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="rounded-md border border-gray-200 p-3 text-sm">
        <p className="font-medium text-gray-900">Payment method</p>
        <p className="text-gray-600 mt-1">Cash on Delivery — pay when your order arrives.</p>
      </div>

      <div>
        <label htmlFor="coupon_code" className="block text-sm font-medium text-gray-700 mb-1">Coupon code (optional)</label>
        <input id="coupon_code" name="coupon_code" placeholder="e.g. WELCOME10" className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm uppercase" />
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={submitting} className="w-full rounded-full bg-brand px-6 py-3 font-semibold text-white disabled:opacity-60">
        {submitting ? 'Placing order…' : 'Place order (COD)'}
      </button>
    </form>
  );
}
