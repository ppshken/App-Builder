# Raw data CRUD and explicit multi-row management

## Behavior
Data > Raw database data retains stored physical values and ID references. It now supports single-row edit/delete, creating up to 100 draft rows, and selecting explicit primary keys across pages (maximum 100). Header selection selects only the current page; refresh clears selection. Table changes remount the editor and an app-context change clears its state. Selection remains stable while navigating pages.

Bulk edit applies only explicitly enabled columns. Other values remain unchanged. NULL is a separate choice; arrays use JSON array input, Ref/User use stored numeric IDs, and generated/read-only fields are excluded. Dynamic editability, validation and required relations are enforced again by the existing record writer. Raw operations do not select a View-specific after-save Action.

Each row uses the ordinary POST/PUT/DELETE /api/data/:table endpoint. No SQL executor or second Action engine was added. Execution is sequential (concurrency 1), with a confirmation/editor dialog, progress, per-row errors and partial success. Successful rows leave the retry selection; failed and unattempted rows remain. New-row drafts that succeeded are removed. Record hooks, auditing, permission checks and child deletion rules remain in the ordinary mutation path.

## Concurrency and uncertain results
Raw GET adds app ID, physical field metadata, effective table rights and a separate versions map; raw rows remain unchanged. PUT includes the existing __version. DELETE now optionally accepts a version query parameter; it validates the stored row and deletes in the same immediate transaction. Existing clients omitting version retain their prior behavior. Requests include x-nocode-app to reject a changed application context.

An in-flight ref prevents double-submit in the current screen. Each request has a 30-second timeout. Network/5xx/invalid response uncertainty stops the sequence and blocks further mutations until the user manually refreshes and checks persisted data. There is no durable bulk-job ledger or cross-tab idempotency guarantee; uncertain writes are never automatically retried. A lost response may represent a committed row. Per-row partial success is intentional; batch-wide rollback is not offered.

## Files
- app/t/[table]/raw/page.tsx: selection, create drafts, targeted bulk edit, confirmation, results and recovery UI.
- app/api/tables/[name]/raw/route.ts: additive metadata/rights/version response fields.
- app/api/data/[table]/route.ts: optional version-guarded delete using the existing delete engine.
- app/globals.css: scoped compact controls and editor layout.
- tests/raw-data-browser.cjs: CRUD and concurrency regressions.

## Verification
- .test-data/raw-crud-integration.log: real browser/API CRUD on isolated SQLite, multi-row create, selection across pages, selected-column bulk update, unchanged fields, stale update/delete 409, partial delete and failed-selection preservation, persistence, original NULL/empty/numeric raw rendering and desktop/mobile navigation.
- .test-data/raw-crud-build.log: optimized Next production build and TypeScript passed.
- .test-data/raw-crud-production.log: same CRUD E2E passed against the production build with an isolated database.
- .test-data/raw-crud-api.log: 18 API regression tests passed.
- .test-data/raw-crud-sharedtables.log: shared-table rights/validation/isolation/regeneration/revocation and responsive UI passed against the production build.

Physical iPhone, production VPS and real connection-drop fault injection were not tested. No production database, Docker volume, credential or deployment changed. SQL Console remains out of scope. Large numbers of rows are managed in batches of up to 100.
