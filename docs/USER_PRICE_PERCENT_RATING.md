# User, Price, Percent and Rating

Choose these types in Data > table > columns. Existing stored columns are unchanged; use conversion preview to change an existing type.

- User: a single active account allowed to enter the current app, using the same membership checks as application login. Stores a stable numeric account ID; names and optional profile photo are displayed. This field does not grant permissions. Changed values are validated server-side for normal saves and Actions. An existing assignment to a disabled/revoked account may be retained while editing other fields, displayed as an unavailable ID. Deleted accounts do not cause business rows to be deleted. Virtual User fields store no relation and should return an account ID.
- Price: a finite numeric value, displayed in THB with two decimal places. Storage and calculations retain the original numeric precision; negative amounts are allowed. This is SQLite REAL, not an arbitrary precision accounting ledger.
- Percent: stores a ratio in the inclusive range 0–1. Enter 25 in the form for 25%; APIs and formulas use 0.25, or accept the explicit string "25%". Formulas such as [cost] * (1 - [discount]) use the stored ratio. Conversion from a numeric column does not implicitly divide by 100.
- Rating: integer 0–5, entered through five accessible star buttons. Clicking the selected last star sets zero; Clear restores null. Zero and empty are different values.

Required, default expressions, virtual expressions, Show_If, Editable_If and Valid_If use the existing validation system. Excel exports Price/Percent as numeric cells with currency/percentage formats. User export supports IDs, display names, or both with the existing reference mode. Import User IDs, numeric prices, ratings and either percent ratios or explicit percent text. PDF values use readable formatting and permitted user names.

The field-user endpoint returns only ID, name, nickname, username and profile photo for eligible active accounts, never credentials, email, department or role. Client requests are scoped to the app and session; lookups are shared briefly within the same app/workspace/user to avoid one network call per rendered cell.
