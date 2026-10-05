'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { STATUS_LABELS } from '@/lib/orders/status';

export function OrderStatusSelect({
  endpoint,
  currentStatus,
  options,
}: {
  endpoint: string;
  currentStatus: string;
  options: string[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(newStatus: string) {
    if (newStatus === currentStatus) return;
    setBusy(true);
    setError(null);

    const res = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });

    setBusy(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(typeof body.error === 'string' ? body.error : 'Could not update status.');
      return;
    }

    router.refresh();
  }

  if (options.length === 0) {
    return <span className="text-sm text-gray-600">{STATUS_LABELS[currentStatus] ?? currentStatus}</span>;
  }

  return (
    <div>
      <select
        defaultValue={currentStatus}
        disabled={busy}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
      >
        <option value={currentStatus}>{STATUS_LABELS[currentStatus] ?? currentStatus}</option>
        {options.map((status) => (
          <option key={status} value={status}>{STATUS_LABELS[status] ?? status}</option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
