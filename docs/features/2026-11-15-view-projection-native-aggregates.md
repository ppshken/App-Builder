# View projection and native formula aggregates

Implemented locally on 2026-11-15. No production deployment, production data changes, schema migration, or new dependencies.

## View-specific loading

Table/List views, including their Dashboard use, request only necessary fields. The selection includes visible fields, title/image/key fields, formula dependencies, formatting and Action conditions, grouping, filters and sorting. Selected Slice predicates retain their required columns. Oversized field URLs fall back to full loading.

List expression snapshots omit datasets used only to calculate server-computed virtual values. Cross-table formatting conditions can request their own snapshots. An optional formatting expression failure does not discard otherwise usable required expression data.

Partial records are marked explicitly. Opening a detail or editing fetches the complete record first. Version tokens are computed from complete physical records for the returned page, retaining concurrency and Bulk protections. Hidden values remain intact when editing. Projection is a performance feature, not an authorization boundary; existing permissions and row rules still apply.

## COUNT/SUM in SQLite

Supported direct projections and simple SELECT predicates can run in SQLite and return scalar results without materializing source records in JavaScript. Permission checks remain mandatory. Predicate acceleration requires an existing suitable index; no indexes are added automatically. Request-local caches do not cross users or requests.

Unsupported expressions retain the existing interpreter. This includes source read row rules, text comparisons, complex predicates, distinct selections, virtual source fields, malformed stored values, and unsupported normalization constraints. SUM uses the native path only when integer values and their absolute total fit the JavaScript safe integer range; fractional and unsafe sums retain interpreter ordering and rounding. Numeric blank handling matches interpreter semantics.

The native path still performs SQLite validity probes and aggregation reads. Zero source rows materialized in JavaScript does not mean zero database reads. Search and virtual-field sorting can still require broad calculation to preserve existing results. Forms and full details intentionally load complete records.

## Verification

- Unit/regression suite: 630 passed, 0 failed.
- API integration suite: 18 passed, 0 failed.
- Browser integration: passed with 20,000 child records, 100 parents and a 25-record page; verified projection, COUNT/SUM, optional expression fallback, filtering/sorting/search, read/update permissions, formatting dependencies, full detail loading, version consistency and hidden-value preservation during edits.
- Production build: passed.
- TypeScript `tsc --noEmit`: passed.
- `git diff --check`: passed.

## Controlled local benchmark

One warmup and five measured runs, in-memory SQLite, 20,000 child records, 100 parent records, 25 records returned. Timings include calculation, complete-row version digest work and JSON serialization; they exclude HTTP, browser rendering and production network latency.

| Mode | Median time | JSON bytes | Source rows materialized into JavaScript |
| --- | ---: | ---: | ---: |
| All fields (native supported aggregates already enabled) | 152.18 ms | 256,524 | 20,000 |
| Selected fields, interpreter aggregates | 28.00 ms | 6,324 | 10,000 |
| Selected fields, native aggregates | 19.90 ms | 6,324 | 0 |

The all-fields comparison includes an unused expensive virtual formula and a large hidden text field. It is a controlled workload comparison, not a measurement of the previous production release or a latency guarantee. Actual gains depend on views, formulas, indexes and permissions.

Evidence: [benchmark JSON](../audits/2026-11-15-view-aggregate/benchmark.json), [browser result](../audits/2026-11-15-view-aggregate/browser-results.json).

Reproduce with `npm test`, `node scripts/integration.cjs api`, `node scripts/integration.cjs viewaggregate`, `node tests/view-aggregate-benchmark.cjs /tmp/view-aggregate-benchmark.json`, `npm run build`, and `npx tsc --noEmit`.
