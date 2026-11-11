# Post-save refresh coordination — 2026-11-11

## Problem and change

After a successful mutation, RuntimeTable read the current collection and notified RunApp. The resulting data revision scheduled a second read of the same collection. An isolated browser reproduction observed two collection requests for one Action (expected one): `.test-data/post-save-before.log`.

The sender now attaches a client-only receipt after a successful authoritative read. It identifies the component instance, table, Slice, collection query and/or record. RunApp still broadcasts the data change; only the matching sender avoids repeating a completed read. Other Views, the visible desktop list behind a detail, and dependent Inline content still refresh.

The receipt does not bypass API authentication, authorization, validation, Action execution, hooks or server caching rules. No database schema or production data changes are required.

## Integration points

- `lib/data-refresh.ts`: scoped acknowledgment decisions; a newer realtime revision always requires revalidation.
- `app/run/page.tsx`: broadcast revision and receipt to rendered Views.
- `app/components/RuntimeTable.tsx`: successful-read acknowledgment for save, Action, delete, bulk completion and import; reuse a successfully retrieved saved record; reject stale query responses.
- `app/components/InlineRelated.tsx`: parent-managed refresh avoids both local and parent invalidation for the same child mutation. Standalone usage retains local invalidation.

Failed, aborted or superseded collection reads do not produce a successful receipt. Changing search/filter/page during an Action prevents the older callback from overwriting the current query. List and detail acknowledgments are independent.

## Reproduction and regression coverage

`node scripts/integration.cjs postsaverefresh` creates an isolated database and uses a real browser to verify:

1. One local collection read after an Action, versus two before the fix.
2. A row leaving a Slice updates membership and count correctly.
3. Form creation returns to the refreshed list.
4. A failed first read is retried through normal invalidation.
5. A search change during a delayed Action is not overwritten by the old query.
6. A pending read that started before a mutation must finish before a new authoritative read can acknowledge that mutation.
7. A Dashboard sender reads once while another visible View independently refreshes; a later remote realtime update reaches both.
8. Inline Action and child creation each refresh the parent record once and child list once. The separate visible desktop backdrop also reads once, intentionally.

Development browser result including the in-flight read race: PASS (`.test-data/post-save-after-dev-final.log`).

Related regression suites passed: realtime Slice coordination, permissions and Bulk Actions on a production build, and configured Inline form return/save behavior on the development server. Logs: `.test-data/post-save-realtimeslice-production.log`, `.test-data/post-save-permissions-production.log`, `.test-data/post-save-bulk-production.log`, `.test-data/post-save-inlineform.log`.

Unit result: 557 tests, 550 passed, 7 skipped, 0 failed (`.test-data/post-save-unit-final.log`). Skipped cases are not claimed as tested.

Final production build: PASS (`.test-data/post-save-build-final.log`). The expanded post-save suite also passed on that build, including the in-flight read race (`.test-data/post-save-postsaverefresh-final-production.log`).

Realtime coordination on the final production build: PASS (`.test-data/post-save-realtimeslice-final-production.log`).

## Remaining scope and risks

- This coordinates reads within the current client. It does not implement server-side row deltas, distributed caching or cross-tab request merging.
- Separate visible Views still issue their own authorized reads. Pagination correction or newer realtime events can legitimately require additional requests.
- Query changes and failed reads intentionally favor correctness over suppressing requests.
- Synthetic browser coverage does not substitute for observing network latency and rendering on a physical iPhone.
- No production database was changed and no deployment was performed.
