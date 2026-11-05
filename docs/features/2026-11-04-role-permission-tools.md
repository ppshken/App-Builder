# App role permission tools

## UI and semantics
- Row conditions move from the lower expandable section to a filter button beside each Read/Create/Update/Delete checkbox. The button is enabled only for an allowed, selected operation. Active conditions are highlighted. The modal edits the role draft; Apply and then Save role persist it. Export continues to use the read filter.
- All selects the currently connected table operations up to their effective dataset/share caps and compatible existing Actions. It is a one-time draft change. Clear all clears draft grants, Actions and row rules.
- Automatic permissions is a persisted, opt-in per-role policy. It grants every operation currently permitted by the app's effective table scope and every compatible Action, including future tables and Actions. While enabled, individual table/Action checkboxes are managed automatically. Row rules remain editable and enforced. Disable automatic mode and Save to freeze the displayed current grants into manual configuration.
- Existing roles default to manual. Only the existing owner-authorized role management endpoint can enable the policy. It does not grant Builder access or override source-table caps, row rules or normal Action availability checks.

## Architecture
_application_local_roles gains auto_grant with a default of 0 and Boolean constraint. Database initialization migrates an old schema additively and database cache version advances to v12. A shared automaticRoleGrants resolver derives grants from the existing application scope and Action permission mapping. accessFor, role overview and readiness use the same resolver. No writes are performed while reading effective permissions. New table grants reflect fresh request app scope; new Actions are resolved on subsequent authorized requests.

Role API validates the automatic flag and computes automatic grants server-side. When disabled it uses existing manual grant validation. Existing row-condition validation remains unchanged. Permission-state audit and normal record mutation enforcement remain in place. Backup copies preserve the new role column through existing explicit-row copy mechanisms.

## Changed areas
app/apps/ApplicationRolesEditor.tsx; app/globals.css; lib/application-auto-grants.ts; lib/application-roles.ts; lib/application-membership.ts; lib/permissions.ts; lib/readiness-permissions.ts; lib/application-schema.ts; lib/schema.ts; lib/db.ts. Test fixtures now explicitly list role columns rather than relying on the old three-column positional insert.

## Validation
- .test-data/role-tools-unit.log: 460 passed, 0 failed, 7 platform-specific skips. New tests cover future connected tables, new compatible Actions, read-only ceilings, row-rule preservation, no Builder escalation, freezing automatic grants, invalid flag rejection, actual old-schema column migration and repeated initialization.
- .test-data/role-tools-integration.log: development UI/API passes. Checks row-rule modal application, All respecting a read-only cap, saving automatic role, future connected table rights, membership, Action/Excel restrictions, SSE permission revisions and desktop/mobile behavior.
- .test-data/role-tools-build.log: production build and TypeScript pass.
- .test-data/role-tools-production.log: role UI/API suite passes against production build with isolated DB.
- .test-data/role-tools-restore.log: actual multi-app restore UI/API, account mapping, namespaces/Ref/rights, sessions and desktop/mobile pass.
- .test-data/role-tools-sharedtables.log: shared-table permission caps, source validation, regeneration, isolation and revocation pass.

No production database, credential, Docker volume or deployment changed. Migration was exercised in isolated fixtures. Physical iPhone not tested. Automatic policies intentionally include future permissions up to the app scope; administrators must opt in and Save the role. Existing open role editor catalogs require refresh to display newly added definitions; runtime resolves current rights on fresh requests.
