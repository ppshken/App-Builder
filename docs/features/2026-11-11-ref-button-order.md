# Ref button mode: initial order and More visibility

## Behavior

- With a button limit of N, an eligible initial set containing N or fewer items does not display **เพิ่มเติม**. A larger result set still exposes the chooser.
- Selecting an item already in the initial N does not move it. Configured Valid_If ordering is preserved.
- Selecting an item outside that initial N promotes that selection into the visible buttons, keeping the configured limit. Example: initial `[1, 2, 3]`, select `6` → `[6, 1, 2]`. Selecting `1` again restores `[1, 2, 3]`.
- Searching in the chooser does not replace the initial button set with the search results. Changing the referenced table, access scope or allowed IDs discards the previous initial set and resets the server query.
- Sparse server pages with a continuation cursor retain access to the chooser so later authorized options remain reachable. The implementation does not scan/download the entire table merely to count options.

## Root cause and change

`ChoiceInput` previously displayed More whenever a remote loader existed, regardless of the result count. `RemoteRefChoice` also prepended every selected record to the result array, then sliced that array into buttons; searches overwrote the same array.

`RemoteRefChoice` now retains the initial unfiltered server page independently of search pages and selected-record hydration. `ChoiceInput` receives that initial set and its continuation state. `lib/choice-buttons.ts` selects the visible buttons without mutating the initial order. Loading/errors remain reachable for button-mode fields even if there is no More button yet.

No server endpoint, save semantics, permissions, database schema or production data changed for this fix.

## Evidence

- Before fix: `.test-data/ref-button-order-before.log` reproduces More being visible for exactly three options with a limit of three.
- Development browser: `.test-data/ref-button-order-after-final.log` PASS. Covers fewer/exact/overflow counts, configured ordering, choosing inside/outside the base set, search, dependent Valid_If changes, save/reopen and mobile viewport.
- Unit suite: `.test-data/ref-button-order-unit.log`: 563 tests, 556 passed, 7 skipped, 0 failed. New pure tests cover stable ordering, promotion/restoration and limits.
- Production Build: `.test-data/ref-button-order-build.log` PASS.
- Production browser suite: `.test-data/ref-button-order-refbuttons-production.log` PASS.
- Visual check: `.test-data/ref-button-order-mobile.png` (synthetic browser; not a physical iPhone test).

Files: `app/components/RemoteRefChoice.tsx`, `app/components/ChoiceInput.tsx`, `lib/choice-buttons.ts`, corresponding unit/browser tests and test-runner registrations.

Related production regressions PASS: `.test-data/ref-button-order-refserver-production.log` and `.test-data/ref-button-order-dropdown-production.log`.
