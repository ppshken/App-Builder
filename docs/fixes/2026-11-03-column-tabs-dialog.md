# Column tabs and app-local calculated-column dialog

Status: Passed — 2026-11-03.

Reproduced vertical overflow in the native column page tabs before editing CSS. The existing negative bottom margin on links combined with overflow-x:auto allowed a vertical scrollbar. Evidence: .test-data/shared-column-layout-before.log (failed no-vertical-scroll assertion).

Changes: column-header tabs use a stable single row with 40 px minimum targets, zero negative link margin, and horizontal-only overflow on narrow screens. The app-local calculated-column modal now uses the existing EditorDialog columnDialog variant, exactly like native column editing. Existing width, padding and responsive rules are reused; ordinary shared-field label dialogs stay compact.

Modified: app/globals.css, app/components/SharedTableSettings.tsx, tests/shared-tables-browser.cjs.

Validation: isolated browser/API sharedtables suite Passed (exit 0), .test-data/shared-column-layout-after.log. Regression checks compare the actual native edit modal width to the app-local calculated modal at 1440 px and 390 px viewports (difference <=1 px); native tab vertical scrolling is absent. Existing shared-table operations still pass. TypeScript --noEmit Passed (exit 0), .test-data/shared-column-layout-types.log. Desktop screenshot inspected: artifacts/shared-virtual-dialog-desktop.png; mobile saved as artifacts/shared-virtual-dialog-mobile.png.

No dependency changes, production database changes or deployment. Physical iPhone not tested.
