-- ============================================================================
-- SK MALLS — 0007_audit_log_insert_policy.sql
-- 0005_rls_policies.sql only granted admins SELECT on audit_logs. Admin
-- actions (seller approval, product approval, order status changes) need to
-- write audit entries too. Additive — safe to run after 0001-0006.
-- ============================================================================

create policy "audit_logs_admin_insert" on public.audit_logs
  for insert with check (public.is_admin());
