# File browser — design proposal

Status: proposal only. No runtime source changes or file deletion performed.

## Repository evidence
- app/apps/AppOperationsManager.tsx currently offers app/type/reference filters, a paginated list and confirmed single-item deletion; no thumbnails or folder browser.
- lib/media-inventory.ts scans source data, metadata, application configuration and user profiles across applications. deleteUnusedMedia rechecks references within an immediate transaction and removes SQLite media/catalog/upload rows only.
- _images and _files hold the primary bytes. lib/form-images.ts records _images.storage_path for optional copies; lib/image-files.ts and lib/file-storage.ts create nested copies beneath uploads. The attachment upload path currently does not persist a file-copy location. Existing rows cannot all be assigned to physical folders reliably.
- _media_catalog records uploader app/user/time but no folder or original image filename. Legacy entries may have no catalog record or upload timestamp. _image_uploads/_file_uploads have no expiry field. Being unreferenced is not sufficient evidence that a just-uploaded form asset is abandoned.

## Layout
Desktop: compact heading and counts, folder tree left, breadcrumb/search/filter/view controls above the file area, optional inspector right. Main file area supports Details and Grid. Mobile: folder drawer, breadcrumb with Back, full-width file area and inspector as a separate sheet.

Smart collections: All files, Unreferenced candidates, Shared across apps, Unsorted, and application roots. These are views, not duplicate storage. Each application root contains expandable nested managed folders. Central assets have a separate root. Unknown ownership remains Unsorted rather than being guessed from a reference in another app.

Details columns: preview + filename, kind, size, added time, owning app/folder, reference status, compact action icons. Grid: lazy thumbnail, short filename, size and reference badge. Both show fallback icons when images cannot be loaded. Selecting an item opens its location, owner, IDs, file size, upload time, references and safe Open/Download/Delete actions.

Preview scope: JPEG/PNG/WebP/GIF and image attachments use protected media endpoints and lazy thumbnails; PDF/Office/archive/video initially use type icons. No arbitrary HTML/SVG/document execution. Generated PDF covers/video posters can follow later. Production thumbnails should be bounded derivatives so the list does not download full-resolution originals for every item.

## Folder model
Use managed logical folders because primary storage is SQLite. Folder operations must preserve /api/images/:id and /api/files/:id references. Record physical copies separately and show their real relative location when known. Do not expose the server filesystem, credentials, database files, Docker volumes or backup directories through this browser.

Proposed additive tables:
- _media_folders: id, owning_app_id nullable for central, parent_id, name, timestamps; unique sibling names, validated ownership, depth limit and cycle checks.
- _media_locations: kind + media_id primary key, folder_id nullable, original_name nullable, copy_relative_path nullable, catalog/source provenance.

Upload writes managed folder/original filename and known copy path transactionally with catalog creation where possible; copied files have cleanup on rollback. Parent folders can be reconstructed from a validated stored relative path for existing image copies. DB-only, unknown or unmatched entries stay Unsorted. Do not infer old locations from a column's current path because that setting may have changed.

MVP folder navigation is read-only. Follow-up supports create/rename/move managed folders and moving media logically, with no reference URL changes. App ownership does not silently change when a folder is moved. Physical copy relocation/deletion is a separate operation.

## Delete all unreferenced
Owner-only, matching the current file administration boundary. Button text includes candidate count. Scope is explicit: chosen application/folder and type filters; all pages in that scope, not just the visible page. Dialog lists count, bytes, scope and sample filenames, and distinguishes SQLite media deletion from optional on-disk copy cleanup. Keep backup packages and existing disk copies untouched in MVP.

Safety/transaction design:
1. Server creates a preview snapshot/token with exact IDs, app/folder/filter scope, creation timestamps and short expiry. The client never supplies authoritative reference state.
2. Exclude active staged uploads; add a tracked upload lifecycle/lease so abandonment can be distinguished from a form still being edited. A recent-upload grace window is an additional safeguard, not a substitute for a lease. Legacy unknown timestamps require explicit review rather than automatic age assumptions.
3. Scan reference sources conservatively. If reference inspection cannot complete or a source cannot be evaluated safely, block cleanup rather than treating it as unused.
4. On confirm, verify owner and scope again. Process bounded chunks, recomputing current references inside each immediate transaction before removing any item in that chunk. Skip newly referenced or missing assets and return reasons. Shared files referenced by any other app are protected.
5. Reuse existing deletion validation and audit semantics, but factor transaction-local deletion so it consumes a checked reference map. Avoid invoking a complete cross-app scan once per file, which would multiply work by the candidate count.
6. Keep progress, resumable execution IDs and completed-item results for large jobs. A lost response must not cause blind retries. Return deleted/skipped/failed counts and bytes actually removed; partial completion is explicit.

Do not automatically choose recently uploaded files merely because references have not yet been committed. Keep permanent deletion behind a concrete preview and confirmation; no automatic scheduled cleanup in MVP.

## API/implementation direction
Extend existing app-management owner-authorized inventory and deletion services. Inventory gains folder/recursive scope, sorting, filename/path query, reference facets, thumbnail URL and separate summary counts. Return paginated metadata; fetch bytes only for visible previews. Folder tree returns counts without enumerating every file. Expensive cross-app reference scans should run once per inventory generation/job with invalidation by relevant metadata/data revisions; a cached inventory must never authorize deletion.

Suggested operations: folder-tree GET; media page GET; cleanup preview POST; cleanup execute POST with snapshot token; job status GET. Reuse routing conventions rather than adding an independent file service in the first phase.

## Phases and acceptance
1. Thumbnails, Details/Grid, app-grouped managed tree, breadcrumb, inspector and safe bulk orphan cleanup with staged-upload protection. Existing source references, app caps and owner-only boundary remain enforced.
2. Create/rename/move managed folders, persist upload path metadata, selected-file management and database-only download/export controls.
3. Bounded thumbnail generation, PDF/video covers, reversible trash with retention, storage quotas and large asynchronous inventory/cleanup jobs.

Tests before implementation completion: other-app reference prevents deletion; live staged form upload protected; preview-to-confirm reference race skipped; missing/expired/wrong-scope token rejected; unauthorized caller denied; legacy unknown ownership/timestamps handled explicitly; folder traversal/symlink/cycle rejected; pagination/filter scope exact; double-submit/retry accounted; thumbnail failure fallback; mobile overflow and dark theme; no copy or backup deletion through SQLite-only cleanup.
