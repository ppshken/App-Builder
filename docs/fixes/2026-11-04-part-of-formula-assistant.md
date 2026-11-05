# Is a part of: parent-context formula assistant

ColumnEditor now adds the existing ExpressionAssistant to part_valid_if, part_show_if and part_add_if. Inline completion and assistant columns use the Ref parent's columns. Each assistant uses a synthetic Boolean condition without permitting a change of the Ref column's data type. The existing global formula helpers remain unchanged unless childListContext is supplied.

Child-list context exposes [_THIS] as a list and supplies a bounded 0?200 sample child count on the Test tab. Its evaluator constructs sample child IDs and returns Boolean results. Apply updates the correct part_* field in the unsaved column draft; normal column Save persists it.

Related runtime fix: expression-data GET previously loaded only part_add_if dependencies. It now also discovers part_valid_if and part_show_if dependencies, including required-related links. SELECT source tables needed for child conditions are available to the form's expression context, subject to existing access checks. A numeric related_required=0 no longer leaks as a standalone React text node in PartOfForms.

Evidence:
- .test-data/part-assistant-regression.log: development browser/API suite passes.
- .test-data/part-assistant-build.log: optimized production build and TypeScript pass.
- .test-data/part-assistant-production.log: production browser/API suite passes. Added checks open all three assistants, verify parent-only [photo] is listed and child-only [parent] is absent, test dynamic COUNT(SELECT(...)) at 5=>TRUE and 6=>FALSE, apply and persist the conditions, and confirm expression-data contains all five category rows. Existing atomic save/rollback, direct API count validation, draft cancellation, mobile nested forms and cascade checks pass.
- .test-data/part-assistant-columnformula.log: existing formula buttons, field/source targeting, save/cancel, syntax rejection and desktop/mobile regression pass.

Tests use isolated databases. No production database or deployment changed. Physical iPhone not tested.
