# File browser: phase 1

Implemented and validated on 2026-11-05. No production database changes or deployment were performed.

## Delivered

- Central Files and Images now opens an Explorer-style browser with application roots, nested logical folders, breadcrumbs, search, type/reference filters, sorting, pagination, list/grid modes and a file inspector.
- Raster image thumbnails use an owner-protected, bounded WebP endpoint. Other file types use icons; HTML/SVG are not executed as previews.
- Uploads persist their original filename and configured folder in additive media catalog fields. App-scoped backups preserve these logical locations and omit server copy paths.
- Bulk orphan cleanup previews an exact scope and requires explicit confirmation. References are checked across applications again inside each deletion transaction. Referenced, pending and recent uploads are protected. Unknown-date legacy assets require a separate opt-in.
- The legacy checkbox responds immediately while a replacement preview is requested; deletion stays disabled until that request completes.
- Responsive folder drawer and inspector, with compact list actions and lazy thumbnails.

## Integration points

UI: `app/apps/MediaFileBrowser.tsx`, `AppOperationsManager.tsx`, `app/globals.css`.

Inventory/orchestration: `lib/media-browser.ts`, `media-inventory.ts`, `media-location.ts`, `app/api/app-management/route.ts`.

Persistence: additive `_media_catalog` fields in schema migration; image/file uploads, staged form images, data writes, settings/profile/user writes and application backups mark/preserve committed media without removing upload ownership claims.

`sharp` 0.35.5, already present in the dependency tree, is explicitly declared for thumbnail generation.

## Safety and current limits

- Folder navigation is read-only in this phase. Folder creation, rename and move are deferred. Folders are derived from managed metadata or known legacy image-copy paths; unmatched legacy assets appear under Unsorted.
- Pending uploads never become bulk-delete candidates solely through age. Cancelled or legacy uncommitted uploads require individual owner review. No expiring staging lease was added.
- Recent means less than 24 hours old. Cleanup uses 100 files per immediate transaction, partial completion, and a maximum 20,000 candidates per preview.
- Preview tokens expire after 10 minutes and are process-local. Restarting the server or routing execution to another replica requires a new preview. Replaying the last chunk is idempotent.
- Cleanup removes SQLite media only. Disk copies and backups remain. Reported bytes are logical payload bytes removed, not reclaimed filesystem capacity; no VACUUM is performed.
- Reference scans can be expensive on very large databases; no persistent reference index was introduced.
- Tests use isolated databases. Physical iPhone, production Docker/VPS and multi-replica deployment were not tested. Mobile browser emulation was tested; this does not certify native iPhone behavior or a complete dark-theme redesign.

## Verification

- Production webpack build: passed (`.test-data/file-browser-build.log`).
- Unit/regression suite: 473 tests, 466 passed, 0 failed, 7 platform skips (`.test-data/file-browser-unit.log`).
- Production integration: all six suites passed: `filebrowser`, `appoperations`, `deferredimages`, `attachments`, `profile`, `api` (API suite: 18 passed, 0 failed). Results are recorded in `.test-data/file-browser-*-final.log`.
- File-browser E2E covers folder navigation, names, thumbnails, list/grid, inspector, cleanup confirmation, fresh-reference races, pending/legacy exclusions, retained disk copies and owner-only access.
- Regression suites cover application operations/backups, deferred form images, attachment boundaries, profile writes and existing APIs.

Regression caught before completion: the deferred-image production test failed with an invalid image ID while saving a database-copy form image. Original filename metadata had accidentally been passed as the filesystem UUID argument. The minimal fix restores `image.id` for the copy operation while retaining the original name in the catalog. The same unchanged browser test passed after rebuilding. Before-fix evidence: `.test-data/file-browser-deferredimages-before-fix.log`.

Test sources: `tests/media-browser.test.cjs`, `tests/file-browser-browser.cjs`; existing regression runners are reused. Screenshots: `artifacts/file-browser-inspector.png`, `artifacts/file-browser-mobile.png`.
