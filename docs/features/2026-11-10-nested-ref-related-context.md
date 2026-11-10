# Nested Ref / Related snapshot context

Confirmed bug: expressionContext.snapshot propagated the original screen ownerTable/parentIds to queued virtual formulas on dereferenced tables. A computed Ref could resolve correctly on the server while preparing client snapshots failed with "no Ref to current parent" for the target score's Related children.

Fix: each queued dependency carries its own Related scope. Dereferenced virtuals use the target table and its loaded row IDs; batches are capped at 500 parents. Merged coverage accumulates parent IDs across batches. Existing authorization, row-level filtering, formulas and 10,000-row limits remain in force. No database migration or production data changes.

Regression: tests/shared-tables.test.cjs constructs imported tables and app-local virtuals: INDEX/ORDERBY/SELECT of eligible Related parents, then [last_order].[score], where score sums Related children. Checks direct evaluation, snapshot evaluation, exclusion of unrelated children, and 504 target rows across batching.

Evidence:
- .test-data/local-ref-before.log: reproduced matching Ref error before fix.
- .test-data/local-ref-after.log: full suite 547 tests, 540 pass, 7 skip, no failures.
- .test-data/local-ref-focused.log: final expanded regression, all 28 shared-table tests pass.
- .test-data/local-ref-build.log: production build passes.
- .test-data/local-ref-permissions.log: production permission regression.
- .test-data/local-ref-relatedsummary.log: existing relatedsummary API assertions passed; UI test stops at expected text "8 items" vs rendered count badge "8". Not a passing UI suite; unchanged UI wording assertion needs separate maintenance. No expectation changed here.

No deployment; actual user data was not accessed. Latest by created_at differs from latest by id; the supplied descending created_at formula is preserved.
