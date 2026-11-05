# View tools and table-wide decorations

## User-facing changes

- View Settings includes Copy View. A deep copy opens as an unsaved draft with an unused internal ID, unique label, independent nested configuration and `system_generated=0`. The source remains unchanged. Existing save validation and the unsaved-change guard are reused.
- View Show_If retains its formula input, gains table-aware completion and opens the existing expression assistant. It has no current-row columns; user/role functions and cross-table expressions remain available. Existing Show_If validation still applies before accepting the formula and on the server.
- Decorations removes the View scope selector. Each table shows its conditional-rule count, including intentional duplicate rules, but excluding duplicate copies of rules across Views and base appearance settings.
- Saving decorations updates all Views of that table atomically, preserving unrelated layout/behavior settings. New Views inherit the table's styles. Clearing table styles is explicitly marked so a stale new-view draft cannot restore old rules.

## Implementation

`lib/data-decoration.ts` consolidates legacy per-View rules in stable View order. Identical rules across Views are counted once; repeated identical rules within one View retain their multiplicity. When legacy base appearances conflict, the first View in `pos,name` order supplies the base appearance. Distinct conditional rules are retained in priority order. Existing limits (20 rules per column) still apply; a larger legacy consolidation must be reduced before saving.

`lib/table-decorations.ts` reads and publishes the table configuration through the existing `_views.display_json` storage. This avoids a schema migration and preserves existing runtime consumers, column rename/delete maintenance, shared-table app scoping and backup paths. The internal `data_styles_scope: "table"` marker persists even when styles are empty. No separate styling engine is introduced.

POST `/api/views` with `op: "table_decorations"` validates styles against the effective table schema, checks an expected baseline inside an immediate transaction, and updates only that table's Views. Stale saves return 409. Existing builder authentication/CSRF/app scope enforcement is reused. View creation/update inherits the table configuration without weakening other Slice/display validation.

At least one View is required for a table before decorations can be saved, as in the previous editor. Editing an existing legacy table collects its prior View rules; the table-wide setting becomes published when Save Decorations is pressed. A table-wide save intentionally replaces conflicting per-View styles. Features that render decorated values consume these styles; this change does not invent a new decoration renderer for chart axes or form controls.

## Verification

Unit results: 472 passed, 0 failed, 7 platform skips (`.test-data/view-decoration-unit.log`). Updated targeted table-decoration tests: 3 passed (`.test-data/view-decoration-targeted.log`).

Production webpack build: passed (`.test-data/view-tools-build.log`).

Production browser/API tests passed: new feature suite (`.test-data/view-tools-viewtools.log`), existing View-name regression (`.test-data/view-tools-viewnames.log`), API regression (18 passed, `.test-data/view-tools-api.log`). The feature suite also creates a real synthetic row, opens a newly created runtime Table View and verifies the rule's rendered text color.

Known validation limitation: the legacy `viewpages` suite did not pass (`.test-data/view-tools-viewpages.log`). It times out trying to click the Home icon without expanding the Display section. Both HEAD and this worktree contain the same collapsed Display details section; its selectors also use the former single-level group-control labels. The test was not weakened or marked passed, and this run does not certify the remainder of that old suite. The current feature and View-name suites exercise the supported controls.

Tests cover deep-copy persistence/source preservation, Show_If assistant persistence, table rule counts, atomic multi-View publishing, future View inheritance, stale-save rejection, cleared-style protection and retaining unrelated display settings. Only isolated databases are used. No production deployment is included.
