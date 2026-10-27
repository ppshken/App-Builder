# System and server report

Open **My Apps → รายงานระบบ & เซิร์ฟเวอร์** (`/apps?tab=reports`). Visible to Builder owner / highest administrator only. `GET /api/system-report` enforces owner access independently, uses the live platform database, ignores selected-app and draft cookies, and returns private/no-store responses.

## Measurements

- Server: successful response plus DB SELECT 1 liveness/latency, operating system/architecture, Node version, process uptime.
- RAM: host total/used/free via Node os functions; process RSS and V8 heap separately. Host figures are not a container memory quota or per-app allocation. All apps share the Node process.
- SQLite: one live primary database shared by all apps. Reports database encoding, journal mode, allocated pages, free pages and physical main/WAL/SHM files. Excludes backup/draft databases and uploaded file/image storage.
- Tables: exact COUNT(*) for physical business tables, allocated B-tree bytes for data and indexes via read-only dbstat, including internal index overhead. Does not evaluate virtual columns or user formulas. Unsupported dbstat or missing tables produce unavailable values and warnings, never fabricated zero sizes/counts.
- App totals: owned plus connected readable tables; per-app configuration storage shown separately. Shared tables appear in each connected app; database-wide totals count them once. Do not sum app totals to obtain database usage. Total business size = table data pages + index pages; free pages and platform/config storage are separate.
- Collation: BINARY is the schema default. Also lists explicit column collations and index key collations from index_xinfo. SQLite has no single database-wide collation. App summary lists collations found in its tables.
- DB Active Connections: unavailable as a server-wide metric in SQLite. Shows the open main connection for the current process and separately the number of instrumented API requests in flight. This is not a query count, user-session count or total connections across other processes/draft/backup tools.

Data/index sizes use [SQLite dbstat](https://www.sqlite.org/dbstat.html); collation semantics follow [SQLite collating sequences](https://www.sqlite.org/datatype3.html#collation).

## Traffic graphs

Authenticated, successfully scoped requests through withAuth are aggregated by minute/app/table for the latest 60 minutes in bounded process memory. Counter updates happen once per completed handler; 4xx/5xx count as errors. Read/write labels classify HTTP methods, not SQL statements or rows modified. Durations cover the scoped API handler/permissions and response creation, not transfer/stream lifetime, login lookup, browser rendering or background Automation execution.

Includes business data, view-data, list, Excel and table routes in table attribution. Other app requests contribute to app totals. Platform requests contribute only to system totals. No payloads, row values, email, password, cookies, full URLs, query strings or disk paths are returned/stored by these counters.

Excludes the report endpoint, Realtime/SSE and workflow activity polling. No timers, synchronous filesystem writes or DB writes added to regular requests. Up to 500 distinct app/table groups per minute; 60 buckets retained. If capped, grouped graphs carry an explicit partial-data notice; global totals remain accurate. Data resets on process restart and is not aggregated across workers/servers. Graphs show no pre-install/restart history and no invented latency for minutes with no requests.

Charts support app/table filtering, API count/errors/latency and app/table rankings by requests, rows or size. Table search and progressive rendering bound large lists. Hover shows chart values; ranking buttons filter the report.

## Refresh and cost

UI fetches every 15 seconds while visible; can pause or refresh manually. No overlapping polls, and pending fetches abort when leaving the page. Last successful data remains on transient failures with an explicit stale/unknown-status notice.

Database inventory is read within a consistent read transaction, cached per connection for 60 seconds. Manual refresh can rescan at most once per five seconds per process. Liveness, RAM, file sizes and API counters update on each request. Counts/dbstat may scan many pages on a very large database; no writes/checkpoints/VACUUM/ANALYZE run to produce this report.

## Validation

- `node scripts/test.cjs`: dbstat sizes/indexes, shared totals, exact row counts, unsupported/missing-table fallback, read-only/cache behavior, counter errors/isolation/retention/caps.
- `node scripts/integration.cjs systemreport`: isolated database; owner-only API/UI, unauthorized users, live scope despite stale app/draft cookies, view-data attribution, filters/refresh, transient failure, desktop/mobile/dark screenshots.
- Synthetic in-memory benchmark on this development machine: one table with 1,000,000 rows plus a text index; inventory about 19 ms, data 20,004,864 bytes, index 19,984,384 bytes. This is a local synthetic measurement, not a production SLA. No test rows added to the user's live database.
