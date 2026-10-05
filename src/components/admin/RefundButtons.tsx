'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function CreateRefundButton({ returnId, suggestedAmount }: { returnId: string; suggestedAmount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    const amountStr = window.prompt('Refund amount (₹):', String(suggestedAmount));
    if (!amountStr) return;

    setBusy(true);
    const res = await fetch('/api/admin/refunds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ return_id: returnId, amount: Number(amountStr) }),
    });
    setBusy(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      window.alert(typeof body.error === 'string' ? body.error : 'Could not create refund.');
      return;
    }
    router.refresh();
  }

  return (
    <button type="button" disabled={busy} onClick={handleClick} className="rounded-md bg-brand/10 text-brand px-3 py-1.5 text-xs font-medium disabled:opacity-50">
      {busy ? '…' : 'Create refund'}
    </button>
  );
}

export function ProcessRefundButton({ refundId }: { refundId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    const reference = window.prompt('Payout/reference note (optional):') ?? undefined;
    setBusy(true);
    const res = await fetch(`/api/admin/refunds/${refundId}/process`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference }),
    });
    setBusy(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      window.alert(typeof body.error === 'string' ? body.error : 'Could not process refund.');
      return;
    }
    router.refresh();
  }

  return (
    <button type="button" disabled={busy} onClick={handleClick} className="rounded-md bg-green-50 text-green-700 px-3 py-1.5 text-xs font-medium disabled:opacity-50">
      {busy ? '…' : 'Mark processed'}
    </button>
  );
}
