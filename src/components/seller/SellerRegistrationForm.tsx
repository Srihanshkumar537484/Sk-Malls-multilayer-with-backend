'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const FIELDS: Array<{ name: string; label: string; type?: string; required?: boolean }> = [
  { name: 'contact_name', label: 'Your full name' },
  { name: 'business_name', label: 'Business name' },
  { name: 'email', label: 'Email', type: 'email' },
  { name: 'mobile', label: 'Mobile number', type: 'tel' },
  { name: 'address', label: 'Business address' },
  { name: 'city', label: 'City' },
  { name: 'state', label: 'State' },
  { name: 'pincode', label: 'Pincode' },
  { name: 'business_category', label: 'Business category (optional)', required: false },
];

export function SellerRegistrationForm() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    const res = await fetch('/api/seller-registration', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    setSubmitting(false);

    if (!res.ok) {
      const body = await res.json();
      setError(typeof body.error === 'string' ? body.error : 'Please check the form and try again.');
      return;
    }

    router.push('/seller/register/success');
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      {FIELDS.map((field) => (
        <div key={field.name}>
          <label htmlFor={field.name} className="block text-sm font-medium text-gray-700 mb-1">
            {field.label}
          </label>
          <input
            id={field.name}
            name={field.name}
            type={field.type ?? 'text'}
            required={field.required !== false}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand"
          />
        </div>
      ))}

      <div>
        <label htmlFor="shop_description" className="block text-sm font-medium text-gray-700 mb-1">
          Shop description (optional)
        </label>
        <textarea
          id="shop_description"
          name="shop_description"
          rows={3}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-brand px-6 py-3 font-semibold text-white disabled:opacity-60"
      >
        {submitting ? 'Submitting…' : 'Submit application'}
      </button>
      <p className="text-xs text-gray-500">
        An admin reviews every application before your store goes live. You&apos;ll be notified once it&apos;s approved.
      </p>
    </form>
  );
}
