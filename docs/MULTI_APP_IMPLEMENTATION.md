# Multi-app platform — implemented scope

Date: 2026-10-26

## Using it

1. Open แอปของฉัน and add an app. Existing Inspection remains the default application and retains its settings and rows.
2. Use ตารางและสิทธิ์ on an app card to connect a central dataset. A new app starts without shared-data access.
3. Set the app's read/create/update/delete/export ceiling. Read is required before other operations. Ref and formula dependencies must also be connected.
4. Permit existing roles to enter the new app. Roles retain their existing table and row restrictions. Builder access and named Actions are explicitly assigned per application.
5. Open the app, or use ตั้งค่า to edit its own theme, header, navigation, Views, Actions, Automation and PDFs.
6. สร้างตารางใหม่ creates an app-owned dataset. The suggested system name includes application identity to avoid collisions with another application's hidden tables. Display labels remain editable.

## Data and configuration boundaries

- One shared SQLite database and account/role directory. This release does not introduce separate organizations or separate user accounts per app.
- _applications: platform registry; ID default maps to the existing app.
- _tables.owner_app_id: ownership of a dataset; all existing tables migrate to default. Physical business tables and row IDs remain unchanged.
- _application_datasets: explicit per-app dataset ceilings. A connected dataset uses the same physical rows, not a copy.
- _application_roles: entry and builder permission for existing roles. Default keeps its existing role behavior.
- Configuration tables use a deterministic namespace per app. Default retains its original table names for compatibility. The database adapter routes trusted configuration identifiers; SQL string literals, parameters and formula values are unchanged.
- Configuration includes Views, Slices, Actions, theme/settings, PDF templates, Automation definitions/jobs, version history, named Action grants and user settings/values. Metadata foreign keys resolve within the same app's configuration namespace.
- Core column schemas remain central. Shared-table schema changes originate in the owning application. Destructive or incompatible schema operations are refused while another app uses the table; label, realtime and additive-column changes remain available to the owner.

## Authorization and navigation

- withAuth resolves membership before application-scoped API execution.
- Table rights intersect app ceilings and original role rights, including Excel. Row policies continue to apply. Named Actions are scoped independently.
- Record writes, Ref resolution, formulas, related data, image/file access and realtime enforce the selected app's dataset boundary.
- Platform app administration, account/role administration, backups and audit administration retain global owner authorization. Normal users can list/open only permitted applications and cannot administer them.
- An HttpOnly application cookie identifies the selected app. Client request headers identify the app which rendered a tab; a mismatch returns 409 before a write runs.
- Switching apps clears runtime caches and separates persistent cache identity. Other tabs keep their form values and show an app-change notice, instead of silently reloading a dirty form.
- Generated app-opening links include application identity. A link for a different app leads to the app chooser before opening its View/row; the destination is validated as a local runtime URL.
- UI access refreshes after metadata changes. SQL schema-rebuild temporary tables are permitted only inside a bounded internal callback.

## Automation, releases and realtime

- Workers drain each app's queue in its own configuration scope, rechecking the actor's current membership and data rights.
- Data events invoke Automations of the application that performed the operation. Automatically dispatching one shared event across multiple apps is deferred until event ownership and duplicate prevention are designed explicitly.
- Draft release files, catalogs, published history and settings are scoped by application. App switching clears the previous active draft cookie.
- Realtime is still opt-in per physical dataset. Authorized apps observe the same committed revision. Streams reevaluate membership/table rights and stop when app access is revoked.
- Audit configuration entries identify the application; the audit viewer remains a platform-owner tool.
- Mobile screen header ownership is elected together across parent/child screens, avoiding a transient duplicate header discovered in regression testing.

## Backup/restore limitation — approval outstanding

Full-file backups still export all apps and shared data. Existing single-app restore remains supported.

Multi-app restore is now implemented following the user's explicit authorization to develop it. The selected account policy preserves current accounts, passwords and platform roles, and maps backed-up application memberships/developer assignments to current users by normalized email. No live database has been restored as part of development. See [MULTI_APP_RESTORE.md](MULTI_APP_RESTORE.md) for the current behavior, limits and verification.

## Validation

- Unit tests: registry/schema migration, metadata non-interference, async scope isolation, dataset ceilings, bounded backup rejection, existing formula/schema/security tests.
- multiapp integration: shared read/write ceilings, Ref/formula/Excel isolation, membership, named Actions, app worker, release draft/publish isolation, realtime revocation, dirty peer-tab preservation, stale-write rejection, deep links, actual table creation, desktop/mobile.
- Regression integration: API, application registry, permissions, Ref creation, inline form View, inline motion, realtime, profile, Excel, saving workflow, navigation contract.
- TypeScript and isolated production build.

All automated validation uses .test-data databases. No test uses the live data.db, and no test inserts business rows into the live database.

## Application launcher and selected-app editor

The root URL and normal sign-in open /apps with app cards and account controls, without the builder sidebar. Selecting Settings sets the app context and opens that app's editor. The editor header identifies the selected app and links back to My Apps. Data management lives at /data; legacy /?new=1 and /?restored=1 links redirect there. Tables and application role grants are managed at /app-access for the selected application. Global users, audit history, and backup tools remain explicitly labelled as platform-wide. Existing app builder memberships control whether a Settings button appears. The configured home view applies when opening an app from the launcher.

Validation: node scripts/integration.cjs launcher (isolated database; desktop and mobile).

## Central management tab

The My Apps page exposes an owner-only central management tab at /apps?tab=central. It includes a global registry/table/connection overview, app connection and role assignment editors, user and role administration, audit history, and existing backup tools. Overview reads metadata only and does not scan business rows. The overview API (/api/applications?overview=1) requires the existing highest owner role; builder permission alone does not grant access. A server check also protects direct central-tab URLs.

Legacy /users, /audit-log and /backups pages redirect to their central sections. Per-app menus no longer contain these global tools. User setting definitions remain app-scoped at /app-access?tab=user-settings, and /users?tab=settings redirects there. No business table is moved or copied, no ownership is changed, and the existing multi-app restore guard is retained. Global changes from a draft continue to require returning to the live workspace using the existing draft banner.

Validation: node scripts/integration.cjs central, using an isolated database and real owner/non-owner sessions.

## Per-application user roles

A central user account keeps its platform role. Owner-only /api/applications?roles=APP_ID and app_role_create/app_role_update/app_role_delete/app_member operations manage independent local role definitions, table/Excel/Action grants, row rules, and per-user assignments. The central UI is My Apps > Central Management > Users per App; the same editor is available under a selected app's Tables and Access page. Local role labels may repeat across applications; internal role IDs are distinct.

An explicit user/app assignment replaces inherited global rights for that app; it never unions them and never grants Builder or platform-owner privileges. Explicit denial remains a stored override and cannot fall back to legacy access. Removing an override is an explicit return to the legacy policy. Users without overrides retain existing behavior. Platform owners retain system access and cannot be assigned a local role.

USERROLE()/USERROLEKEY(), row rules, Action execution, Excel, cache identity and realtime permission revisions use the assigned application role. Background work already rechecks accessFor in the originating application. The launcher remains available even when the default application is denied, does not preload private settings from an unauthorized default app, and it does not open an unauthorized default-app realtime stream. App role and membership mutations are audited. Deleting Actions, deleting tables and publishing configuration reconcile local Action grants so deleting and reusing a name cannot revive an old grant.

New permission tables are additive and no existing user password, platform role, business row or Ref is rewritten. A pre-migration backup follows the existing initialization mechanism. Full file backup remains available. Restore supports local-role metadata through trusted schema reconstruction and email-based account mapping; the former multi-app/local-role rejection guards have been replaced with validation.

Validation: 9 local-role unit tests plus existing unit suite; node scripts/integration.cjs approles covers actual owner/user APIs, one account with different rights in two apps, row rules, USERROLE formulas, Action/Excel permissions, Builder escalation denial, SSE permission-only updates, UI role creation/assignment, desktop/mobile, and loss of access to the default app.

## Builder management separated from application data permissions

The central account section is now labelled บัญชีผู้ใช้และ Builder. Its สิทธิ์จัดการ Builder tab lists accounts and per-application developer assignments, without another table/Excel/Action/row-rule editor. Application data permissions remain solely in ผู้ใช้รายแอป. Only the live platform owner may manage accounts or assign developers.

Existing installations enter compatibility mode. The owner activates the transition once with ย้ายสิทธิ์เดิมและแยกการจัดการ in the Builder tab. The owner-authorized POST makes a file backup first, then one transaction copies inherited effective permissions for each currently connected app/dataset into local roles, preserves USERROLE()/USERROLEKEY() identity, copies app-specific Actions and row rules, and separates existing per-user developer assignments. Existing explicit local memberships and denials remain untouched. Conflicting local role names/labels abort the whole transaction instead of overwriting roles or changing formula identity. Repeating a successful migration is a no-op.

After activation, there is no global runtime permission fallback. Newly created accounts and new apps require explicit app membership or developer assignment. Legacy global role mutation APIs and returning an app membership to inheritance reject with 409. Global account classifications remain for identity/owner protection, and existing users/passwords/business records are never rewritten. Developer grants are independent of app runtime roles; developers have full management/data access within the app's dataset ceiling. Revoking a developer assignment returns the user to the explicit runtime role. A denied runtime membership alone does not revoke independent developer rights, and the members editor labels these users.

Full backup export and multi-app restore with separated-security/local-role metadata are supported; see MULTI_APP_RESTORE.md. Activating this transition is an explicit owner operation, never a GET side effect. Tests never activate it on the live database.

Validation: 5 migration/permission tests in tests/builder-security.test.cjs; node scripts/integration.cjs buildersecurity covers the actual migration UI, preserved sessions/accounts/Excel, developer grant/revoke and owner-only APIs, local-role editor, and desktop/mobile layouts. Other central management, per-app role, API regressions and production build are also checked.

## Developer tool access (menu/API alignment)

An assigned app developer can use the selected app's Data, Views, decorations, Actions, Automation/PDF, diagnostics, user-setting definitions and releases. Menu visibility, server page guards, API guards, draft workspace headers and preview settings now consistently use effective builder permission. Release manifests retain their per-actor restriction and app-scoped storage; removing development access blocks further draft/Automation/PDF management immediately. Scheduled Automation rechecks effective app development access instead of requiring a platform-owner account.

The app-access page exposes user-setting definitions to developers; global app connections, dataset-sharing ceilings, member/role assignment, accounts, audit and backup administration remain owner-only. Developer-only access does not expose the central-management tab or permit granting another user's development access. The expanded isolated buildersecurity browser/API scenario exercises these boundaries, a scheduled Action, app-local settings, private draft editing and revocation.
