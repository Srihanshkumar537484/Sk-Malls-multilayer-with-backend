'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function ReturnReviewButtons({ returnId }: { returnId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function act(approve: boolean) {
    const notes = window.prompt(approve ? 'Any notes? (optional)' : 'Reason for rejecting:') ?? undefined;
    if (!approve && !notes) return;

    setBusy(true);
    const res = await fetch(`/api/returns/${returnId}/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approve, notes }),
    });
    setBusy(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      window.alert(typeof body.error === 'string' ? body.error : 'Could not update return.');
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-x-2">
      <button type="button" disabled={busy} onClick={() => act(true)} className="rounded-md bg-brand/10 text-brand px-3 py-1.5 text-xs font-medium disabled:opacity-50">
        Approve
      </button>
      <button type="button" disabled={busy} onClick={() => act(false)} className="rounded-md bg-red-50 text-red-700 px-3 py-1.5 text-xs font-medium disabled:opacity-50">
        Reject
      </button>
    </div>
  );
}
