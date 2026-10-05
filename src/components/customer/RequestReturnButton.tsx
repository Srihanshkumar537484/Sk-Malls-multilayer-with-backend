'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function RequestReturnButton({ orderItemId }: { orderItemId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handleClick() {
    const reason = window.prompt('Why are you returning this item?');
    if (!reason) return;

    setBusy(true);
    const res = await fetch('/api/returns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_item_id: orderItemId, reason }),
    });
    setBusy(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      window.alert(typeof body.error === 'string' ? body.error : 'Could not request a return.');
      return;
    }

    setDone(true);
    router.refresh();
  }

  if (done) return <span className="text-xs text-gray-500">Return requested</span>;

  return (
    <button type="button" onClick={handleClick} disabled={busy} className="text-xs text-brand font-medium disabled:opacity-50">
      {busy ? '…' : 'Request return'}
    </button>
  );
}
