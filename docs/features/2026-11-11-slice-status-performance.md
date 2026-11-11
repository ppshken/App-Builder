# Slice status performance investigation

User formula: [status] = 3. The fixture models status as a physical Ref. No user database was read or modified.

Confirmed implementation bottleneck: /api/data/<table> used Slice SQL only in its paged fast branch. Unpaged all=1 requests (Dashboard/nested lists), Ref-label search and virtual sorting fell back to calculating every source row, then interpreting the Slice. Simple Slice predicates therefore became unnecessarily expensive.

Fix: reuse the existing conservative sliceSql plan to preselect candidate raw rows whenever no other raw-row selection was made. Existing paged fast selection and explicit id lookup remain intact. readRows still applies row permissions; Slice interpreter/filter/sort/labels still execute as before. Unsupported predicates keep whole-expression interpreter fallback. No indexes, schema migrations, expression semantics or permissions changed.

Production-build isolated fixture: 20,000 source rows, 2,000 match status 3; same three measured requests per case. Times include HTTP parsing and response materialization; no throughput or physical-device guarantee.

| Request | Before median ms | After median ms |
|---|---:|---:|
| Plain table page | 19 | 11 |
| Slice page | 28 | 12 |
| Slice all rows | 5581 | 250 |
| Slice with Ref-label search | 2339 | 244 |
| Slice with virtual sorting | 2667 | 239 |

Evidence: .test-data/slice-status-before.json, .test-data/slice-status-after.json; logs share the same stem. Benchmark source: tests/slice-status-performance.cjs (mode slicestatusperf). Optional SLICE_PERF_MAX_MS applies a local benchmark budget; not an unconditional cross-machine SLA.

Checks: all results satisfy status=3 and expected counts, unpaged Slice intersects row permissions, excluded id cannot bypass Slice, virtual predicate fallback still returns expected rows. Existing permission browser suite passed (.test-data/slice-status-permissions.log), conservative compiler's four unit tests passed (.test-data/slice-status-unit.log), build passed (.test-data/slice-status-build.log).

Limits: original user View location and status column metadata were not supplied. If status is virtual, the SQL optimization is intentionally unavailable. Dashboard still calculates all matching rows, so it can cost more than a 25-row paged table. No production deployment.
