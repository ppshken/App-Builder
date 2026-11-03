# Shared column modal numeric flag and checkbox alignment

Confirmed reproduction: physical column editor footer rendered a literal 0 between Cancel and Save. is_virtual is stored as numeric 0; JSX short-circuit emitted that number. Both conditional operands now coerce to Boolean. The Label checkbox has a scoped flex row, 8px gap and fixed 18px dimensions.

Regression: tests/shared-tables-browser.cjs asserts no standalone 0 in footer, checks Label, saves settings and exercises existing virtual editor. Before fix failed with actual footer containing 0 (.test-data/shared-column-modal-before.log). After fix entire sharedtables integration passed (.test-data/shared-column-modal-after.log), including scroll, import, schema regen, revocation and responsive dialogs. Only isolated test databases used; production untouched.
