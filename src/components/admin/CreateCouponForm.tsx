'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Option = { id: string; label: string };

export function CreateCouponForm({ sellers, categories }: { sellers: Option[]; categories: Option[] }) {
  const router = useRouter();
  const [scope, setScope] = useState('platform');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    const res = await fetch('/api/admin/coupons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(typeof body.error === 'string' ? body.error : 'Could not create coupon.');
      return;
    }

    (event.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 p-4 max-w-xl space-y-3">
      <p className="font-semibold text-sm">New coupon</p>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Code</label>
          <input name="code" required placeholder="WELCOME10" className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Scope</label>
          <select name="scope" value={scope} onChange={(e) => setScope(e.target.value)} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm">
            <option value="platform">Platform-wide</option>
            <option value="seller">One seller</option>
            <option value="category">One category</option>
            <option value="product">One product</option>
          </select>
        </div>
      </div>

      {scope === 'seller' && (
        <select name="seller_id" required className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm">
          <option value="">Choose seller</option>
          {sellers.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
      )}
      {scope === 'category' && (
        <select name="category_id" required className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm">
          <option value="">Choose category</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      )}
      {scope === 'product' && (
        <input name="product_id" required placeholder="Product ID" className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Discount type</label>
          <select name="discount_type" className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm">
            <option value="percentage">Percentage</option>
            <option value="fixed">Fixed amount (₹)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Discount value</label>
          <input name="discount_value" type="number" step="0.01" min="0" required className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-600 mb-1">Min order (₹)</label>
          <input name="min_order_value" type="number" step="0.01" min="0" defaultValue={0} className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Max discount (₹)</label>
          <input name="max_discount_amount" type="number" step="0.01" min="0" className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-600 mb-1">Usage limit</label>
          <input name="usage_limit" type="number" min="1" className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-600 mb-1">Expires (optional)</label>
        <input name="expires_at" type="date" className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
      </div>

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={submitting} className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {submitting ? 'Creating…' : 'Create coupon'}
      </button>
    </form>
  );
}
