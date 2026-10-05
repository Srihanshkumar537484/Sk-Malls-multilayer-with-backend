'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function StatusActionButton({
  endpoint,
  action,
  label,
  variant = 'default',
  needsReason = false,
}: {
  endpoint: string;
  action: string;
  label: string;
  variant?: 'default' | 'danger';
  needsReason?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    let rejection_reason: string | undefined;
    if (needsReason) {
      rejection_reason = window.prompt('Reason (shown to the seller/on the product):') ?? undefined;
      if (rejection_reason === undefined) return; // cancelled
    }

    setBusy(true);
    const res = await fetch(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, rejection_reason }),
    });
    setBusy(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      window.alert(typeof body.error === 'string' ? body.error : 'Action failed.');
      return;
    }

    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className={`rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
        variant === 'danger' ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-brand/10 text-brand hover:bg-brand/20'
      }`}
    >
      {busy ? '…' : label}
    </button>
  );
}
