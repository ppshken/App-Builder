# Table row action styles

Configuration: View > Screen layout > Table > Row button style. The shared display editor also supports app defaults and Inline table overrides.

- `horizontal` (default): icon-only controls for Edit, Delete and permitted Actions, arranged horizontally. Action names remain available as tooltips and accessible labels.
- `buttons`: icon and text buttons.
- `menu`: three-dot trigger with permitted Edit, Delete and inline Actions in a floating menu.

Metadata uses `display_json.table_action_style`; no database migration is required. Existing per-row permissions, Action availability conditions, callbacks and delete confirmation remain in force. Inline tables retain their existing edit/action and draft-removal rules; this change does not grant persisted-row deletion.

The menu supports Escape, arrow keys, Home/End, outside dismissal, viewport positioning and native dialog containers. Clicking controls does not trigger row navigation.

## Verification

- Full unit suite: 509 tests; 502 passed, 7 platform skips, 0 failed. Evidence: `.test-data/table-action-styles-unit.log`.
- TypeScript: `npx tsc --noEmit --incremental false` passed.
- Isolated production build (`next build --webpack`, `.next-check`): passed. Evidence: `.test-data/table-actions-build.log`.
- Isolated browser integration: `node scripts/integration.cjs tableactions` passed. Covers Builder save, all three layouts, Action execution, edit/delete confirmation, denied row permissions, hidden Actions, keyboard/outside dismissal, mobile viewport bounds, Inline action refresh and a native detail dialog. Evidence: `.test-data/table-action-styles-browser.log`.
- Browser mobile coverage uses viewport emulation; physical iPhone testing is not included.

No production database changes or deployment were performed.
