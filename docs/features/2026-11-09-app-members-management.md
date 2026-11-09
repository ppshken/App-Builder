# Per-app member management

## Scope
Central management > Users per app. Existing Builder-owner authorization is unchanged.

- Compact member table: avatar/name, nickname, username, email, account type, app role, active status and individual save.
- Department grouping (including unspecified), collapsible groups, search and department/role/status filters.
- Stable user-ID selection across pages/filters, maximum 100. Header and department checkboxes select only displayed page rows (50 per page); never all database accounts implicitly.
- Bulk role selector and confirmation name the app, role and selected accounts. Role-card shortcut opens the matching member filter.
- Switching apps clears selection and drafts. Errors preserve selected IDs for correction/retry.

## Backend
PUT /api/applications uses existing owner-only app_* handler with op app_members, app id, user_ids and role_name. Existing app_member validation/upsert is shared without changing single-member semantics. Immediate transaction makes assignments atomic; invalid account/role/owner rolls back the whole batch. IDs deduplicated, raw batch capped at 100. Existing audit triggers record changes.

Only the selected application's membership changes. Global roles, other apps and Builder grants remain unchanged. Disabled accounts stay disabled; assignment does not activate login. Builder owner cannot be reassigned. Full profile fields remain owner-only and do not expand the public formula user directory.

## Verification
- Full unit suite: 545 tests, 538 passed, 7 skipped, 0 failures (.test-data/app-members-unit.log).
- Isolated browser/API suite: tests/app-members-browser.cjs; covers page/group/row selection, selection across pages, cancellation, duplicate-click request guard, persistence, single-member save, search/filter/role shortcut, app switch reset and mobile containment.
- API negatives: non-owner denial, protected owner, missing account, foreign app role, oversized batch, atomic rollback, cross-app isolation and audit records.
- Screenshots use synthetic accounts only: artifacts/app-members-desktop.png and artifacts/app-members-mobile-dark.png.

## Limits
Catalog still loads all owner-visible accounts before client pagination, as the previous overview did. Server-side account pagination is a future scalability improvement. Bulk operations assign an existing role only; disabling/inheritance remains an explicit individual operation. No production database changes or deployment.

## Final production-build checks
- Optimized Next.js build passed (.test-data/app-members-build.log).
- appmembers passed on production build (.test-data/app-members-production.log).
- Existing approles regression passed (.test-data/app-members-approles-regression.log).
- Existing permissions regression passed (.test-data/app-members-permissions-regression.log).
- Visual review: desktop light and mobile dark screenshots; mobile table scroll is contained inside the table, with no document horizontal overflow. Dark CSS checked using explicit data-mode; this does not claim physical iPhone testing.
