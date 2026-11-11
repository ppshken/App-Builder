# Complete form Ref options

Confirmed: RuntimeTable.loadFormRefs requested /api/data/<target>?sort=id&dir=asc. The existing unpaged endpoint intentionally returns at most 500 records unless all=1 is explicit. Consequently selected/searchable Ref values outside the first 500 vanished from form options.

Minimal fix: form Ref loading now requests the existing all=1 mode. Generic API default and paged table endpoints are unchanged. Existing table permissions, row rules and per-column Valid_If filtering remain in force. Shared RuntimeTable forms (Builder/runtime/inline) use the same loader.

Evidence:
- .test-data/ref-all-before.log: actual browser reproduction, option ID 600 absent.
- .test-data/ref-all-production.log: 600 synthetic source rows, choose/save ID 600, reopen existing row and show selected label, restricted runtime user can select ID 550 but only receives permitted IDs 501-599.
- .test-data/ref-all-permissions.log: existing permission regression.
- .test-data/ref-all-build.log: production build.

Tests use isolated databases only. No production changes or deployment. This removes the 500-option truncation, not formula-engine row limits. All accessible form choices are loaded into memory; this is not a scalability guarantee for very large option sets. Server-side searchable pagination remains a separate future improvement.
