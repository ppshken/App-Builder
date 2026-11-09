# Desktop primary navigation order

Desktop side menus now place Primary Navigation first, in its existing configured order, before ungrouped and named Menu Navigation groups. Mobile drawer behavior and persisted positions are unchanged. No database migration.

Implementation: lib/views.ts menuViewGroups seeds the unnamed group with Primary views before grouping remaining menu views. Runtime filtering, visibility and permissions remain unchanged.

Verification:
- Regression reproduced before fix: tests/view-order.test.cjs failed on a named/ungrouped menu preceding Primary.
- Full unit suite after fix: 546 tests, 539 passed, 7 skipped, 0 failures (.test-data/primary-nav-unit.log).
- Targeted browser test passed for desktop collapsed/expanded and mobile (.test-data/primary-nav-browser.log).
- Existing desktopnav suite stops at a pre-existing hardcoded expanded-width expectation (300 vs current 260); its source was left unchanged. The new focused browser test verifies this change independently.
- Build evidence: .test-data/primary-nav-build.log.

No deployment or production data changes.
