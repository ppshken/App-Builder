# System user accounts

The central account editor supports the following fields:

| Field | Required | Notes |
| --- | --- | --- |
| Display name | Yes | Existing name field; up to 100 characters |
| Profile image | No | JPG/PNG/WebP; resized before saving, circular display |
| Nickname | Yes | Up to 100 characters |
| Account username | Yes | English letters, digits, dot, hyphen or underscore; up to 100 characters; phone-number usernames retain leading zeros |
| Email | No | Valid email when supplied; normalized to lowercase; stored as NULL when absent |
| Department | Yes | Text, up to 100 characters |
| Password | Yes on creation/reset | 4–128 characters; hashed using the existing scrypt implementation |

Account usernames and supplied emails are unique without regard to letter case. The server also rejects cross-field collisions that could make a login identifier refer to two accounts. Login accepts either username or email in the same textbox. Existing API clients may still submit the login identifier through the `email` property; the `username` property takes precedence when supplied.

The current user can edit nickname, display name and picture from Profile, with the picture shown first. Account username and department are read-only there. Account username/email, department and account authorization remain administrator-managed; the profile API ignores attempts to change those fields. Required fields and password length are validated server-side as well as in the UI. Password reset and profile password changes use the same length policy.

## Existing accounts and migration

Initialization backs up existing on-disk databases before the identity migration and runs the schema change transactionally with a foreign-key check. IDs, password hashes, account roles, active state, session rows, membership/developer assignments and profile images are preserved. AUTOINCREMENT history is retained even if the old user table is empty.

For old accounts, the existing email is the initial account username and the existing display name is the initial nickname. Legacy email-shaped usernames can remain unchanged during editing; administrators can replace them with a normal account username. Department remains empty until supplied, because it cannot be inferred safely. Existing accounts can still log in; completing an administrator account edit requires the department; profile edits preserve the administrator-managed department.

New user creation through `/api/users` requires `username`, `nickname` and `department`. The first-owner setup API retains compatibility with older bootstrap clients that supply only name/email/password; the setup UI requires all new mandatory fields.

Email-less users have `user.email === ''` in session and account responses. `USEREMAIL()` consequently returns an empty value for these users. Use the existing stable `USERID()` identity where a formula must distinguish every user, including users without email. Runtime cache scopes already include user ID and application ID.

## Backups and restore

Existing restore matching by email remains unchanged for accounts with an email. When both source and current accounts lack email, matching uses their unique account username instead. No match is inferred from display name, nickname, department or numeric row ID. Current accounts and passwords remain preserved by the existing restore policy.

## Verification

- `node scripts/test.cjs`: account requirements, hashing, case-insensitive aliases, shared per-account login throttling, no-email restore mapping, old authentication migration and existing regressions.
- `node scripts/integration.cjs accounts`: central editor creation/edit/photo, optional email, numeric username, 4-character passwords, mobile login and profile password change without email.
- Existing `auth`, `profile` and `api` integration modes exercise authentication, authorization and session behavior.
- The identity migration was additionally run against an isolated copy of the actual database; the source was opened read-only. Original credentials, account relationship counts and foreign keys were verified unchanged.

Older integration fixtures receive explicit test-only defaults for required identity fields in `scripts/auth-test-preload.cjs` when they omit the username entirely. Tests for the new contract supply the identity fields explicitly and verify rejected empty required values; the production endpoints have no test bypass.
