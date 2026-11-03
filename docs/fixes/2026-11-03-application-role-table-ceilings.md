# App role editor respects connected table permissions

## Cause and change
Role configuration listed connected tables but did not expose their effective app-level permissions. Checkboxes accepted every operation, while runtime applied a narrower dataset/share ceiling. The role management API also accepted impossible grants.

lib/application-roles.ts now obtains each table's effective permissions from the existing applicationScopeFor resolver (including managed shared-table caps and external read-only behavior). The owner-only role catalog returns rights with every readable table. Role create/update rejects any grant above that ceiling with HTTP 403 inside the existing transaction. Runtime access checks remain unchanged.

ApplicationRolesEditor disables disallowed operations and shows an explanation. Opening an existing role normalizes its draft to current ceilings, removes unavailable Actions and disconnected row rules, and does not modify persisted permissions until Save. Narrowing table permissions still takes effect immediately through runtime enforcement; reopening the editor reflects the current ceiling. Stale form submissions are checked again server-side.

## Evidence
- Before: .test-data/role-ceiling-before.log, 9 passed / 1 failed because catalog omitted rights.
- After: .test-data/role-ceiling-unit.log, 450 passed / 0 failed / 7 platform-specific skips.
- .test-data/role-ceiling-integration.log: real API rejects an attempted write grant on a read-only link with 403; browser confirms View enabled and Create/Update/Delete/Excel disabled, saves reader role, and validates membership, row rules, actions, Excel, SSE access revision, desktop/mobile and revoked app access.
- .test-data/role-ceiling-sharedtables.log: shared-table UI/API regression suite passes, including source revocation and central permission reconciliation.

All mutable tests used isolated databases. No production data or deployment changed. No physical iPhone test performed.
