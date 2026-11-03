# Imported table create permission mismatch

Date: 2026-11-03

## Confirmed root cause
The central owner-only Tables and permissions editor saved _application_datasets, while imported table access additionally intersects _table_shares. A read-only import retained can_create=0 in the share cap even after the central editor enabled create. Runtime and POST correctly rejected the resulting effective permission.

## Change
lib/applications.ts setApplicationDataset now updates the existing shared cap (or creates the required cap for an overlay-managed table) within the existing dataset transaction. Legacy connections without shares or overlays keep their original behavior. Central API owner authorization and per-user role checks are unchanged. ApplicationAccessEditor dispatches the existing metadata refresh event after successful save.

Source sharing still defines source caps; it does not automatically reconnect tables or widen independent target-app restrictions. Central owner edits explicitly reconcile both stores.

## Reproduction and regression evidence
- tests/shared-tables.test.cjs: read-only import, enable create/update centrally, resolve fresh effective permissions, disable again.
- Before fix: .test-data/shared-permission-before.log ? 24 passed, 1 failed (expected true, actual false).
- After fix: .test-data/shared-permission-unit.log ? 449 passed, 0 failed, 7 platform-specific skipped.
- tests/shared-tables-browser.cjs: HTTP central permission disable -> POST 403; enable -> actual POST succeeds; cleanup through source app. Existing import, local metadata, schema regeneration, source validation, isolation, revocation and responsive UI scenarios pass.
- .test-data/shared-permission-integration.log records these integration results against an isolated database.
- .test-data/shared-permission-api.log ? 18 API tests passed.

## Operational notes and limits
No production database, credentials or deployment changed. Existing mismatched permissions are not silently elevated: disable and re-enable the intended option in the central editor to persist the corrected pair. Refresh an already-open application tab after changing permissions in another tab. No physical iPhone or production VPS test performed.

- Multi-app regression: .test-data/shared-permission-multiapp.log ? shared read/write ceiling, formula/Ref/Excel isolation, stale tabs, membership, worker and desktop/mobile switching passed.
