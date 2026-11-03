# Shared column settings scrolling and density

The Data shell hides overflow for columns-settings-page. The shared settings panel had neither constrained flex height nor its own scrolling, making lower columns unreachable.

Scoped CSS gives the panel flex:1, min-height:0 and overflow:auto. The table wrapper no longer nests scrolling. Header stays sticky, cell padding and buttons are smaller, and display/system names appear on one line. Native table settings are unaffected.

Validation: node scripts/integration.cjs sharedtables passed against an isolated database. New browser regression uses 32 physical columns at 1440x720, confirms positive scrollTop at the end, viewport-contained panel and row height <=44px. Existing sharing/import, local labels/formulas, regeneration, access revocation and responsive dialog checks also pass. Evidence: .test-data/shared-column-scroll.log. Physical iPhone not tested; production untouched.
