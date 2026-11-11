# Formula editor regression closure

## Confirmed defects
1. ApplicationRolesEditor.insertRule deferred focus/selection to requestAnimationFrame without checking whether the user had replaced the formula. A delayed helper callback moved the caret to position 7 in a newer 21-character formula. FormulaEditor.commit had a similar unguarded deferred selection callback.
2. FormulaEditor inserted edits via the native value setter and synthetic input events, bypassing the browser undo transaction. The existing unchanged Ctrl+Z assertion exposed unexpected previous formula content after inserting a newline.

## Fix
- Role helper callbacks verify textarea identity, expected current value and focus ownership before applying selection. They cannot focus a different/newly edited control.
- Shared editor deferred selection is guarded by current value, interaction version and focus. Later edits/selections/blur invalidate older callbacks.
- Editor-generated edits use the browser native editing command when supported, preserving undo, and retain the previous setter/input fallback for unsupported implementations. Formula parsing, evaluation and row-permission validation are unchanged.

## Test evidence
- tests/formula-caret-race-browser.cjs deliberately holds animation-frame callbacks, replaces the formula, then releases callbacks. Before fix: .test-data/formula-caret-before.log, actual caret 7 vs expected 21. Final: .test-data/formula-caret-after.log passes helper and autocomplete replacement races, subsequent typing, no stale focus steal, saved row rule equality.
- .test-data/formula-caret-roles.log: previously failing full per-app role suite now passes, including row rules, owner UI, role formulas, Action/Excel permissions and SSE permission revisions.
- .test-data/formula-caret-editor.log: full shared-editor browser suite passes tokens, multiline/Undo, auto-sizing, horizontal scrolling, incomplete syntax rejection, persisted formula, mobile viewport and dark mode.
- .test-data/formula-caret-permissions.log: existing API/browser permissions suite passes.
- .test-data/formula-caret-unit.log: 9 formula editing/completion/highlighting tests pass.
- .test-data/formula-caret-build.log: final production build/TypeScript pass.

The old shared-editor test also assumed fixed height and vertical scrolling. Existing auto-size styling predates this task (app/globals.css lines 9949-9958, commit 685557bc). Those obsolete layout assertions were replaced with checks that the gutter stays within textarea height and all lines remain visible. The Undo assertion and saved-formula expectations were preserved; source code was fixed to pass them.

## Scope and limits
No dependencies, database changes, migrations or deployment. Production tests use isolated synthetic databases. Physical iPhone/Safari and browsers lacking native editing-command support were not tested; fallback behavior is retained. This completes the first prioritized task; duplicate local refresh, server-backed Ref search and row-level realtime events remain separate work.
