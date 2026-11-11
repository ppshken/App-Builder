# Uniform data-row heights

Data rows within the currently displayed table use the natural height of its tallest data row. Rows with empty images, thumbnails, multiline text, Enumlist values or different available Actions align vertically. Headers and group headings retain their own sizing.

This preserves full wrapped content, existing cell padding, font scaling and interactive controls. It does not crop data or impose a fixed pixel height. A page containing especially tall wrapped content will make its other data rows equally tall; heights are recalculated for the visible page rather than scanning other database pages.

## Implementation

- `app/components/UniformTable.tsx` keeps a native table and calculates one shared CSS variable from natural data-row heights. It resets the previous height during measurement so rows can shrink too.
- `RuntimeTable` and `InlineRelated` use the component for View, Inline/draft Inline and Builder data tables. List/card layouts and configuration/permission grids are unchanged.
- CSS applies the height only to direct tbody data rows; header and group rows are excluded.
- DOM/content changes, image completion, fonts, width changes and global appearance changes schedule measurements in a single animation frame. Hidden tables skip work; observers/listeners are disconnected on unmount. Own CSS-variable writes are ignored to avoid observer loops.
- This introduces no network requests, React state updates, database/schema changes or Action/save logic changes.

## Evidence

- Before: `.test-data/uniform-table-before.log` reproduced a **57.875 px** difference between data rows.
- Development browser PASS: `.test-data/uniform-table-after-complete.log`.
- Production Build PASS: `.test-data/uniform-table-build.log`.
- Production browser PASS: `.test-data/uniform-table-uniformrows-production.log`. Tests cover uploaded portrait/landscape images and empty images, wrapped text, Enumlist values, sparse Actions, separate group headers, View/Inline/Builder tables at 1440 px and 390 px, actual realtime growth/shrink and idle observer stability.
- Sample measurements: View and Inline rows were all **107 px** in the fixture. After realtime edits they changed together to **51 px**, then **151 px**. Full synthetic metrics: `.test-data/uniform-table-row-metrics.json`.
- Existing header/density/custom-padding and table Action suites PASS: `.test-data/uniform-table-inlineheader-production.log`, `.test-data/uniform-table-tableactions-production.log`.
- Unit suite: 563 total, 556 passed, 7 skipped, 0 failed (`.test-data/uniform-table-unit.log`). DOM geometry was tested in a real browser, not inferred from unit tests.
- Mobile visual inspection: `.test-data/uniform-table-inline-mobile.png`; emulated browser viewport, not a physical iPhone test.

No production database was modified and no deployment was performed.

Post-save / Slice / Dashboard / Inline refresh regression also PASS on the production build: `.test-data/uniform-table-postsaverefresh-production.log`.
