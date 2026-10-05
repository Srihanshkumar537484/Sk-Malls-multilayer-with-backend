import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Writes one audit_logs row (spec section 57: who/what/when/record/old/new).
 * Best-effort — a logging failure should never block the underlying admin
 * action, so callers should not await-and-throw on this; just fire it after
 * the real write succeeds and swallow errors.
 */
export async function writeAuditLog(
  supabase: SupabaseClient,
  params: {
    actorId: string;
    action: string;
    table: string;
    recordId: string;
    oldValue?: unknown;
    newValue?: unknown;
  }
) {
  try {
    await supabase.from('audit_logs').insert({
      actor_id: params.actorId,
      action: params.action,
      record_table: params.table,
      record_id: params.recordId,
      old_value: params.oldValue ?? null,
      new_value: params.newValue ?? null,
    });
  } catch {
    // Audit logging is best-effort; never fail the caller's real action over this.
  }
}
