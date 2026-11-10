# Dashboard viewport height

Dashboard Grid and Tabs use the remaining runtime viewport height. Configured dashboard_height remains the minimum grid row height; mobile stacked views retain their configured heights. Existing responsive column count and small/wide/tall/large spans remain intact.

useDashboardLayout measures the grid top, visible bottom navigation and viewport, including visual viewport changes. ResizeObserver and resize listeners update measurements through requestAnimationFrame and are cleaned up on unmount. Hidden zero-width routes do not alter sizing. Active Dashboard pages reserve 12px bottom spacing instead of the generic footer space.

Regression evidence:
- Before: .test-data/dashboard-viewport-before.log, fixed row height did not decrease when viewport height decreased.
- After: .test-data/dashboard-viewport-after.log, viewport resize/tablet/mobile stack/tabs passed in isolated browser testing.
- tests/dashboard-viewport-browser.cjs additionally checks independent panel scrolling and viewport containment.
- Existing mixed-layout test now asserts the tall/small span ratio rather than fixed desktop pixels, because desktop rows expand to fill available space. Mobile fixed-height assertions remain unchanged.
- Production build: .test-data/dashboard-viewport-build.log.

No production database changes or deployment. Real-device iPhone testing is not claimed.

Final checks: production dashboardviewport passed (.test-data/dashboard-viewport-production.log); existing dashboardlayout suite passed, including mixed spans, resize, search, Builder save/reload, Show_If and row permissions (.test-data/dashboard-viewport-layout-regression.log). Production build passed. Desktop and mobile-tab screenshots visually reviewed with synthetic data.
