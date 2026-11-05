# Table surface styles

View > Screen layout > Table > Table style offers plain (legacy default), striped rows, cell grid, and minimal row separators. The existing comfortable/compact density and explicit row padding settings remain independent. These settings also work in Inline tables and app-level table defaults.

`display_json.table_style` accepts `plain`, `striped`, `grid`, `minimal`. No schema migration or record changes. Colors use existing theme variables. Group rows and selected rows keep their existing emphasis. Action execution, permissions, sorting, filtering and pagination are unchanged.

Validation:
- Unit suite: 510 tests, 503 passed, 7 platform skips, zero failures (`.test-data/table-surfaces-unit.log`). Includes accepted/invalid styles, default inheritance and explicit View override.
- Browser integration: `.test-data/table-surfaces-browser.log`. Covers Builder selection/save, all four surfaces, compact cell padding, visible grid and minimal borders, Inline grid and existing row controls/permissions.
- TypeScript: `.test-data/table-surfaces-types.log`.

Browser testing uses desktop/mobile viewport emulation, not physical iPhone hardware. No production database modifications or deployment.
