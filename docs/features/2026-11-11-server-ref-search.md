# Ref search from the server — 2026-11-11

## Behavior

Ref form fields no longer download the entire referenced table before the form opens. The existing dropdown and button-choice controls load 25 options at a time, search after a 250 ms debounce, and offer **โหลดเพิ่มเติม**. A selected value is hydrated separately by ID, including IDs beyond the first 500 or 10,000 rows. Label images are included when configured.

Search covers the referenced table, not just the options already loaded in the browser. Explicitly loaded pages use stable cursors rather than row indexes. The footer identifies the number of loaded options, not the size of the database.

Existing frontend Valid_If choices narrow the query and retain their order. The query does not grant any permission or replace backend save validation. Selected values outside the current Valid_If list retain the existing disabled presentation. Existing add-new Ref, scanning, parent auto-fill and dependent resets use the original form/save engines.

## Files and contract

- `app/api/ref-options/[table]/route.ts`: authenticated POST read endpoint; refreshes existing external sources through the existing adapter.
- `lib/ref-options.ts`: validates query/cursor/IDs, applies table/app/row access and projects label/image output. Reuses `referenceLabelColumns` and the existing expression context for computed labels.
- `lib/auth-api.ts`: treats this specific endpoint as a table read; authenticated users do not require Builder or create permission to search readable reference rows. Normal origin and app/workspace boundaries remain enforced.
- `app/components/RemoteRefChoice.tsx`: paged fetches, selected-ID hydration, cancellation, generation checks, retry and preservation of the chosen label.
- `ChoiceInput.tsx`, `SearchSelect.tsx`, `RemoteChoiceStatus.tsx`: preserve the existing controls and theme; add optional remote loading, errors and pagination. Local Enum/Enumlist behavior remains local.
- `RuntimeTable.tsx`: removes `loadFormRefs()` bulk downloads and integrates the remote control only for readable Ref targets.

Request example:

```json
{"query":"Choice 20050","cursor":0,"selectedIds":[],"allowedIds":["20050","20049"]}
```

`allowedIds` is optional and can only narrow authorized rows. It is not trusted as a permission grant. `selectedOnly: true` retrieves up to 20 explicitly selected labels without scanning a result page.

Response:

```json
{"rows":[{"id":20050,"__label":"Choice 20050","__image":null}],"selected":[],"nextCursor":null}
```

The cursor is scoped to the current query and allowed-ID order; the client resets it when those change. There is no overall 500-row option cap. Each request examines bounded batches (at most 2,000 candidates) so sparse row permissions and computed-label searches can return an empty page with a continuation cursor. Users can continue or narrow their search. The API does not return unauthorized labels, raw record fields or a global row count.

## Evidence

`tests/ref-server-search-browser.cjs` / integration mode `refserver` creates an isolated database with 20,050 referenced rows and uses HTTP and a real Edge browser to check:

- Initial 25-row result, continuation, no overlapping IDs and selection of row 20,050.
- Search across the whole table, selected label hydration, persisted save and edit reopen.
- Ref button mode, explicit Valid_If IDs and their order.
- Stale search-response cancellation and retry after a synthetic 503.
- Computed labels and Unicode case-insensitive matching.
- Row-level authorization, selected hidden IDs, narrowed queries and sparse-policy continuation.
- Rejection of invalid cursors, excessive search length, unauthenticated requests and SQL-like search text.
- No frontend `all=1` download of the Ref target when opening/editing a form.
- A touch-enabled 390×844 browser layout; screenshot `.test-data/ref-server-mobile.png`. This is not a physical iPhone test.

Development evidence: `.test-data/ref-server-final-dev2.log` (PASS). On this synthetic fixture, the old full-table response was **4,279,595 bytes**, versus **1,281 bytes** for one new page. Local dev timings were 1,414 ms and 59 ms respectively; they are not a production latency guarantee.

Existing unit suite: **557 total, 550 passed, 7 skipped, 0 failed**, `.test-data/ref-server-unit.log`. Skipped tests are not claimed as executed.

## Final verification

- Production Build PASS: .test-data/ref-server-build-release.log.
- New API/browser suite PASS on that build: .test-data/ref-server-refserver-production.log. Production-fixture timings: full response 163 ms, page 10 ms (local synthetic measurements only).
- Permissions and previous post-save refresh regression PASS: .test-data/ref-server-permissions-production.log and .test-data/ref-server-postsaverefresh-production.log.
- Existing Ref >500 options, Inline form View, add-new Ref, backend Ref Valid_If, and shared Dropdown suites PASS: .test-data/ref-server-refalloptions.log, .test-data/ref-server-inlineformview.log, .test-data/ref-server-refcreate.log, .test-data/ref-server-refvalidif.log, .test-data/ref-server-dropdown.log.
- git diff --check PASS. No new dependencies installed.

## Scope and limitations

- This optimizes Ref choice loading; it does not rewrite the formula engine or remove its existing limits for explicit cross-table SELECT/ORDERBY expressions. Forms that explicitly request large formula snapshots may still need separate optimization.
- Substring search on physical labels uses parameterized SQL. Computed labels and non-ASCII case folding use bounded evaluation with continuation. No new search index is installed.
- Per-column pagination avoids global caches that could mix users, apps or workspaces. Identical readable Ref fields can each make a small initial request.
- A row can change after selection. The existing backend validates the actual write and current permissions; choosing an option does not reserve that row.
- No production data, credentials or deployment were changed.


## Follow-up: read-only Ref requests must not emit write notices

The client fetch wrapper classified POST Ref searches as writes. Opening a form emitted saving/saved events, invalidated persistent runtime storage and showed an incorrect save Snackbar. AuthProvider now excludes only /api/ref-options/ from write tracking; authentication, server permission checks and actual form writes are unchanged.

Regression reproduced before the fix: .test-data/ref-open-notice-before.log captured saving/saved events during form opening/searching. After the fix: .test-data/ref-open-notice-after.log passed, asserting no write events or Snackbar during Ref selection and confirming a real save still emits saved. The same suite also verifies search errors and retry.
