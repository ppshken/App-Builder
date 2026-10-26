# Production readiness work
User authorized all five priorities, in order, 2026-10-20.
1. App health: configuration dependency checks and deep links, explicit sample-data checks.
2. Read-only simulation: real Action evaluation and ordered before/after trace; Automation condition, parent Action and external-step plan; no network/PDF/queue side effects.
3. Isolated configuration draft workspace, publish/release history/rollback; reject structural schema edits until explicit conversion; publish configuration only, never simulated data/auth.
4. Saving/connectivity state, pending writes and conflicts without automatic retry of mutations.
5. Repeatable browser/mobile and large-data regression + physical iPhone checklist and measured results.

Constraints: do not use real data.db for tests; isolated DBs only. Existing behavior remains default until a draft workspace is created explicitly. All configuration validation and permissions must remain enforced. Physical iPhone unavailable, mark as pending.

Progress: auditing existing infrastructure. Backups, row versions, saving workflows, loading, mobile and integration tests already exist. Need extend these, not duplicate.

Implemented: health endpoint/page with sample checks and fix links; Action traces and rollback simulation; Automation condition/parent Action/webhook/PDF planning without external effects; draft database scoped per owner request, publication conflict/review checks, version snapshots in SQLite and configuration-only rollback; connection/pending/uncertain status; bounded progressive dashboard rendering for >1,000 rows.
Verified so far: 204 original unit tests; readiness integration including isolated data, publish/rollback, permissions passed. Running 10k-row and network failure browser test. Still required: final regression/build, expanded safety tests, physical-device checklist, documentation and artifact review.

10k mobile/network verification passed: paginated API 519ms, last-row mobile search 334ms, dashboard initial 1058ms with 200 rendered rows, automatic progressive scrolling and search verified. Network uncertain result retains form, sends once, offline state visible, delayed save prevents duplicate submit. Device: Chromium touch emulation, not physical WebKit.

Completed implementation and delivery verification: 206 unit tests, 15 API regression tests, dashboard, concurrent edits, smooth mobile navigation, saving workflows, image gallery, readiness/releases security, runtime background refresh, form preservation, and 10k-row/network tests passed. Final production build compiled successfully. Draft Preview checked after data finished loading. Reports: artifacts/readiness-verification.json and artifacts/readiness-performance.json. Physical iPhone verification remains pending; see docs/PRODUCTION_READINESS.md. No tests were run against the live database.
