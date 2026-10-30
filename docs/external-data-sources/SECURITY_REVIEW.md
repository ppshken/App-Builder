# Security review — External Data Sources

วันที่ 2026-10-30 · รีวิวและทดสอบเฉพาะการเปลี่ยนแปลงนี้ ไม่ใช่การรับรองว่าระบบทั้งหมดปลอดภัย

| Boundary | Implementation | Evidence |
| --- | --- | --- |
| Management authorization | withAuth session/CSRF/app context + builder-only source handlers | No session API 401; reader management denied; cross-app source lookup 404 |
| Runtime read/write | Existing table/row grants; external SQL view readonly; write rights capped server-side and in renderer | Unit and browser API create/delete rejection; add UI hidden |
| Outbound SSRF | Exact-origin HTTPS443 policy, reject private/reserved IPv4/IPv6, validate all DNS answers, pinned lookup + socket peer comparison | Unit blocked ranges/encoded loopback/private DNS and transport options; E2E private origin/redirect/next limits |
| DNS rebinding boundary | Connect to validated IP rather than resolving again; verify actual socket peer | Unit custom lookup assertion; real public HTTPS smoke. No hostile public DNS server was deployed |
| TLS and redirect | rejectUnauthorized=true, same-origin opt-in redirect <=2, revalidate destination | Mock options assertions, cross/private redirect rejection; real TLS call succeeds |
| Credential boundary | Server env registry with app+origin scope; frontend metadata contains references only; known secret values stripped before response processing | Browser authenticated preview masks known value; registry response and per-app backup contain no synthetic credential value |
| Configuration injection | Strict object field lists, safe identifiers, no prototype paths, allowlisted headers, no direct credential query/body, no mapping code execution | Unit invalid config/path/mapping; runtime SQL and API regression tests |
| Resource bounds | 2MiB response, 10MiB traversal, record/page/depth/text/time limits, 4 requests/process, shared quotas, bounded retries | Oversize/compression/content type API tests; unit page completion/loop and 40/source/120/app quota checks |
| Sync consistency | Fetch outside transaction, map all rows, atomic upsert/checkpoint, active-job unique index, CAS lease, precommit generation/config/permissions checks | Idempotent upsert, duplicate prevention, failed schema mapping preserves original row and checkpoint |
| Destructive policy | Keep default; delete typed confirmation, no empty-upstream wipe, reject incoming Ref/List | Config tests; destructive live deletion intentionally not executed |
| Backup trust | Reconstruct exact generated views; reject other/tampered view SQL; no uploaded SQL execution | Full staging/restore twice + tampered view rejection; scoped restore and clone tests |
| Automation | Source steps/events through existing validation/worker; no sync-trigger recursion, no summary row updates, vault env forbidden as legacy webhook bearer | Summary formula + loop validation; actual queued sync→refresh E2E; old workflow regressions |

## Residual risks / limitations

- Allowlisting a remote service is a trust decision. A permitted remote can return malicious or sensitive business data; preview masking is a heuristic, not a PII classifier. Operator must authorize fields and use read-only upstream accounts.
- POST policy and user checkbox do not prove that the remote endpoint is side-effect free. Do not allow write-capable endpoints or credentials.
- Environment secrets are outside the DB backup; secure the host, secret manager, process inspection permissions and log collection. This release does not provide an encrypted credential editing UI or OAuth refresh service.
- LIVE snapshots can hold business data in SQLite. Existing backup, storage protection and app permission controls still apply. The engine strips known credential values and secret-named object fields but does not promise automatic removal of arbitrary secrets disguised as ordinary data.
- Formulas read stored snapshots. They cannot guarantee upstream freshness. Source cache/schema definitions are not publish-versioned; mutation in Draft is blocked.
- The existing webhook engine remains a separate integration boundary; the new connector's pinned HTTPS transport does not automatically retrofit every existing webhook. The new vault variable is explicitly blocked from legacy bearer_env usage.
- This release adds SQLite jobs, not a distributed queue. No multi-host failover, sustained load benchmark, real credential-provider integration, hostile DNS infrastructure or production deployment was tested.
- AUD-002 Login policy and AUD-003 Framework upgrade remain paused as previously requested; neither was implemented by this task.

หลักการอ้างอิงที่ตรวจเมื่อ 2026-10-30: [OWASP SSRF Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html), [Node HTTPS](https://nodejs.org/api/https.html).
