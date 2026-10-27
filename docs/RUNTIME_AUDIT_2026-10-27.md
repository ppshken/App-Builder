# Runtime bug and performance audit — 2026-10-27

## Scope and safety

The existing local database was inspected through a read-only SQLite connection with `query_only=ON`. No business data was changed. Browser, API and build checks used separate test databases. Measurements below are local development measurements, not a physical iPhone benchmark.

## Fixes

- Large-table pagination now reads from the nearest end of the sorted result, reversing both sort direction and the ID tie-breaker when needed. Count and page selection share one read transaction. Nullable and duplicate sort values, filters, empty results and partial final pages are covered by SQLite comparison tests.
- Custom-page formula snapshots and retained runtime routes now invalidate when effective permissions change. Legacy role responses now expose their existing row-rule metadata so the client can detect such changes. Server-side access enforcement remains in place.
- Diagnostic API timing excludes Realtime streams and background workflow activity polling. These long waits should not be interpreted as slow data requests.
- Stopping a diagnostic recording flushes pending observer entries before saving. Recordings are bounded to 60 seconds and hidden-tab pauses do not count as slow frames.
- Diagnostics now include navigation-ready P95, browser/viewport information and a JSON export. Comparisons reject incompatible known device environments. Exports exclude request bodies, row contents, query values, cookies and formula source text.

## Measurements

The existing database contains 15 tables and 304,606 rows (approximately 58.99 MB). Its largest test table contains 300,000 rows.

| Measurement | Before | After |
| --- | ---: | ---: |
| Last-page SQLite query, median | 37.056 ms | 0.134 ms |
| Last-page SQLite query, P95 | 54.757 ms | 0.553 ms |

These are nine interleaved samples after warmup, selecting the same final 25 IDs in the same order. They exclude COUNT, HTTP, network and rendering. They do not describe the improvement of the whole application.

Isolated 300,000-row browser/API checks:

| Measurement | Result |
| --- | ---: |
| Warm final-page HTTP, median / P95 | 25.700 / 29.392 ms |
| Search requests for one typed phrase | 1 |
| List refetches after repeated detail/back | 0 |
| List DOM detachments during detail/back | 0 |
| Recorded navigation samples | 9 |
| Navigation-ready median / P95 | 6.100 / 685.200 ms |
| Recorded API median / P95 | 464.400 / 685.300 ms |

Browser measurements used Chromium mobile-touch emulation at 390 × 844. Navigation-ready measures the route update through the ready render commit, not completion of the transition animation. Its sample includes the first cold development load and subsequent cached transitions, explaining the difference between median and P95. Automated navigation round-trip median was 229.302 ms, including test waits and transition time.

Artifacts:

- `artifacts/actual-database-readonly-2026-10-27.json`
- `artifacts/pagination-before-after-2026-10-27.json`
- `artifacts/runtime-audit-2026-10-27.json`
- `artifacts/runtime-audit-measurements-mobile.png`

## Validation

- Unit suite: 272 tests passed.
- API integration suite: 15 tests passed. Updated its default-settings assertion to include the existing optional Navigation Bar height setting.
- Production build: passed using an isolated database and `.next-check` output.
- `runtimeaudit`: pagination correctness, debounced search, retained list DOM, navigation recording, background exclusion and safe JSON download passed.
- `custompagev2`: role read-rule changes remove previously visible records and formula snapshots while the new authorized snapshot loads.
- `perfdiagnostics`: scoped read-only diagnostics, resource recording, before/after UI and responsive layout passed.
- `readinessperf`: 10,000-row scenario, bounded Dashboard rendering, pending form state, failed requests and offline form preservation passed.
- `returnstability`: eight-record list retained the same DOM node without detachment, reordering or reload on Back.
- `crossmenu`: a cached Menu A detail did not appear during Menu B navigation or Back.

## Physical-device follow-up

On the actual iPhone, open **วิเคราะห์ความช้า**, start recording, use **ไปใช้งานแอพ**, then repeat the same search → detail → inline → back → save flow. Stop recording and export the result. Compare runs on the same browser, viewport and dataset. Record the visible symptom separately: navigation-ready timing does not prove animation smoothness.

Physical iPhone traces, a one-million-row benchmark and large-table row-rule performance remain unmeasured. The existing formula snapshot size limit is unchanged.
