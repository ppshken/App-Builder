# Row permission formula editor

The app-role row-rule modal now reuses FormulaEditor with highlighting and autocomplete. The role catalog includes minimal physical column metadata for each connected table, matching the server rule validator's non-virtual column boundary. The dialog displays chips for table columns (plus internal id) and supported account functions: USERID, USERNAME, USEREMAIL, USERROLE, USERROLEKEY and ISOWNER. Chips insert at the current cursor selection.

FormulaEditor's optional rowRule mode scopes completions to those columns and ordinary functions. It does not fetch global table metadata, offer cross-table sources, or suggest USERSETTINGS/SELECT/lookup functions and unsupported special row tokens. Other editor instances preserve their previous behavior. Actual row-rule security and validation stay in the existing backend; manually pasted unsupported expressions are still rejected there.

Evidence:
- .test-data/row-rule-editor-dev.log: app-role browser/API suite passes. Added checks type USERRO and accept USERROLE(), type [ and accept the physical email column, ensure virtual who is absent, suppress USERSETTINGS, insert account/column chips at the cursor, then Apply and Save the valid rule.
- .test-data/row-rule-editor-build.log: optimized production build and TypeScript pass.
- .test-data/row-rule-editor-production.log: same app-role UI/API suite passes against production build, including row conditions, automatic grants, membership, permissions and desktop/mobile layout.
- .test-data/row-rule-editor-formula-regression.log: existing formula buttons, save/cancel, syntax errors and desktop/mobile regression pass.

All mutable tests use isolated databases. No production data or deployment changed. Physical iPhone not tested.
