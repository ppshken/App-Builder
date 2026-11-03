# Shared table import modal layout

Status: Passed. Date: 2026-11-03.

The Builder's general input sizing applied to native radio inputs inside the shared-table picker. Reproduced with the existing isolated browser suite: the radios measured 650 × 42 px and pushed their labels beyond the modal. Evidence: .test-data/shared-import-layout-before.log (failed compact-radio assertion).

Changes are scoped to SharedTableDialog: introduce a modal class, constrain native radios to 18 × 18 px, give the copy area min-width:0, separate title/origin and identifier/count into compact rows, truncate long titles/source names/identifiers, make search full width, and bound vertical list scrolling. Other Builder inputs retain their styles. Backend/data logic is unchanged.

Files: app/components/SharedTableDialog.tsx; app/globals.css; tests/shared-tables-browser.cjs.

Verification:
- node scripts/integration.cjs sharedtables: Passed, exit 0. Evidence .test-data/shared-import-layout-verified.log.
- Regression asserts each radio <=24 px in both dimensions and no horizontal overflow in modal body/list on Desktop and 390 px mobile, including dark mode. Long table/app/system names are included in synthetic fixtures. Existing share/import, local labels/formulas, validation, regen, permissions and revocation assertions remain intact.
- TypeScript --noEmit: Passed, exit 0. Evidence .test-data/shared-import-layout-types.log.
- Screenshots visually inspected: artifacts/shared-import-desktop.png; artifacts/shared-import-mobile-dark.png. Light mobile screenshot also saved as artifacts/shared-import-mobile.png.
- No deployment or production database changes. No new dependencies. Physical iPhone not tested.
