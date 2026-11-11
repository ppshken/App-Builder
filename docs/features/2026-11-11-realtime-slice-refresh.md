# Realtime Slice refresh improvements (phase 1)

## Behavior
- GET /api/data/<table> retains its JSON contract and includes X-Nocode-Realtime-Versions, captured before synchronous row reads. Tokens match SSE database-generation/revision tokens; only readable, enabled tables are included.
- RealtimeSync includes revision tokens in its existing client event. useRealtimeRevision batches notifications, skips versions already represented by a completed read, retains dirty state while inactive/hidden, and never suppresses forced access changes.
- RuntimeTable separates first/query loads from background invalidations. Background refresh preserves rows and does not toggle the foreground loading indicator. The queue serializes reads, coalesces bursts, and starts background reads no more frequently than every 1.5 seconds under sustained invalidation. Changes during an older read receive a trailing fresh read rather than being discarded.
- Same-query foreground reads share an in-flight promise. Background invalidation waits for an older read and then reads afresh; query/unmount cancellation prevents old trailing work from overriding a new query.
- Runtime cached inactive list/table routes defer refresh and catch up when activated. Visible desktop detail backdrops remain active. Document-hidden tabs defer refresh until visible.
- Scoped list expression snapshots are not separately fetched by the realtime effect when the row loader already refreshes them.

## Correctness boundary
Server Slice predicates and row/table permissions remain authoritative. Actual new table revisions can still require reloading the whole matching Slice; row-delta updates and selective membership evaluation are phase 2, not implemented here. Missing version headers/events use conservative refresh. Access/metadata handling remains in place. This targets RuntimeTable list/table/Slice views; it does not claim complete optimization of map/chart/calendar runtime loaders or targeted cache invalidation across every module.

## Verification
- .test-data/realtime-queue-unit.log: full suite 553 tests, 546 passed, 7 skipped, 0 failed. Queue tests cover bursts, one trailing read, pause/resume/dispose, sustained update spacing and version coverage.
- .test-data/realtime-slice-before.log: pre-change production build has no read-version acknowledgement header; coverage test fails as expected.
- .test-data/realtime-slice-after.log: production API/browser test passes real Node SSE revision updates and browser Slice entry/exit, 20 covered-version events cause no read, 20 burst events cause one read, quiet delayed refresh, writes during delayed response yield the newest state, no concurrent reads, forced access refresh, hidden document/cached route catch-up. Header ACL test excludes unreadable realtime table names.
- .test-data/realtime-slice-permissions.log: existing permission browser/API regression passes.
- .test-data/realtime-slice-build.log: optimized production build and TypeScript pass.
- .test-data/realtime-slice-roles.log: extended per-app roles suite passes API/SSE authorization checks but stops in the role-rule formula-editor UI at a formula validation error after autocomplete interactions (expected saved read-only role not shown). Reproduced twice; this UI path was not changed for this task and is not claimed passed. Needs separate investigation.

No production database changes, migration, deployment or physical iPhone performance claim. Read-version header size grows with the number of readable realtime tables. Realtime notifications remain table-level, and some explicit local callbacks can still request an additional authoritative refresh.

Follow-up: the previously failing per-app role formula UI check has been resolved and the full approles suite passes. See docs/features/2026-11-11-formula-editor-race-fix.md and .test-data/formula-caret-roles.log.
