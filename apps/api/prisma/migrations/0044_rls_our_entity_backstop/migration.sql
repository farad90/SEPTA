-- P1-E4-F1-T1 — Row-Level Security backstop for the our_entity_id multi-company
-- boundary (purchase_orders, supplier_rfqs, employees, financial_proposals,
-- technical_proposals). Application-level filtering is not removed or
-- changed by this migration — this is a database-level safety net
-- underneath it, for the query that someday forgets a WHERE clause.
--
-- ⚠️ INTENTIONALLY NON-ENFORCING AS SHIPPED. RLS is ENABLEd and policies are
-- created below, but NOT paired with FORCE ROW LEVEL SECURITY. In Postgres,
-- a table's OWNER always bypasses RLS unless FORCE is also set — and the
-- application's database role (the same one that runs `prisma migrate
-- deploy`, including this migration) owns these tables. That means, exactly
-- as shipped, this migration changes nothing about what the running app can
-- see or do: it's an audit-mode scaffold, matching this task's design
-- ("deploy in PERMISSIVE/audit mode first, confirm zero legitimate traffic
-- would be blocked, then flip to enforcing").
--
-- Two things must both happen, deliberately, as a separate follow-up, before
-- this provides real protection:
--   1. The app must SET LOCAL app.current_entity_ids on every request, to
--      the caller's accessible our_entity_id list. NOT wired up by this
--      migration — the "which entities can this user access" business rule
--      isn't fully defined at the application layer yet (the prior security
--      audit's finding was that entity scoping today is ad hoc and
--      per-service, not a single reusable rule this migration can safely
--      assume).
--   2. Then either ALTER TABLE ... FORCE ROW LEVEL SECURITY on each table
--      below, or have the app connect as a non-owner database role.
-- Do not do either of those without first testing against a real copy of
-- production data — a bug in the session-variable logic would make queries
-- silently return zero rows, not throw an error, which is a much worse
-- failure mode than doing nothing.

ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_rfqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE technical_proposals ENABLE ROW LEVEL SECURITY;

-- One policy per table. A row is visible/writable when:
--   - the table's our_entity_id is NULL (only possible on the three
--     nullable columns below — no group company has been assigned yet), or
--   - app.current_entity_ids was never set for this session (NULLIF(...,'')
--     collapses both "never set" and "set to an empty string" to NULL), or
--   - our_entity_id is in the caller's comma-separated allowed-entities list.
-- No FOR clause means each policy applies to SELECT/INSERT/UPDATE/DELETE
-- alike, once enforcement is actually turned on (see note above).

CREATE POLICY entity_scope ON purchase_orders
  USING (
    NULLIF(current_setting('app.current_entity_ids', true), '') IS NULL
    OR our_entity_id = ANY (string_to_array(current_setting('app.current_entity_ids', true), ',')::uuid[])
  );

CREATE POLICY entity_scope ON supplier_rfqs
  USING (
    NULLIF(current_setting('app.current_entity_ids', true), '') IS NULL
    OR our_entity_id = ANY (string_to_array(current_setting('app.current_entity_ids', true), ',')::uuid[])
  );

-- employees.our_entity_id is nullable (self-service pending state, see
-- migration 0043) — a personnel record not yet assigned to a group company
-- must stay visible to HR regardless of entity scoping.
CREATE POLICY entity_scope ON employees
  USING (
    our_entity_id IS NULL
    OR NULLIF(current_setting('app.current_entity_ids', true), '') IS NULL
    OR our_entity_id = ANY (string_to_array(current_setting('app.current_entity_ids', true), ',')::uuid[])
  );

-- financial_proposals.our_entity_id is nullable (older rows predating
-- migration 0025, before this column existed).
CREATE POLICY entity_scope ON financial_proposals
  USING (
    our_entity_id IS NULL
    OR NULLIF(current_setting('app.current_entity_ids', true), '') IS NULL
    OR our_entity_id = ANY (string_to_array(current_setting('app.current_entity_ids', true), ',')::uuid[])
  );

-- technical_proposals.our_entity_id is nullable, same reason as above.
CREATE POLICY entity_scope ON technical_proposals
  USING (
    our_entity_id IS NULL
    OR NULLIF(current_setting('app.current_entity_ids', true), '') IS NULL
    OR our_entity_id = ANY (string_to_array(current_setting('app.current_entity_ids', true), ',')::uuid[])
  );

-- ============================================================================
-- ROLLBACK (not executed automatically — this project has no down-migration
-- tooling yet; run manually if this migration needs to be reverted):
--
--   DROP POLICY entity_scope ON purchase_orders;
--   DROP POLICY entity_scope ON supplier_rfqs;
--   DROP POLICY entity_scope ON employees;
--   DROP POLICY entity_scope ON financial_proposals;
--   DROP POLICY entity_scope ON technical_proposals;
--
--   ALTER TABLE purchase_orders DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE supplier_rfqs DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE financial_proposals DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE technical_proposals DISABLE ROW LEVEL SECURITY;
--
-- Safe to run at any time, including after enforcement was later turned on
-- (FORCE + session-variable wiring) — disabling RLS never destroys data,
-- only access-control metadata.
-- ============================================================================
