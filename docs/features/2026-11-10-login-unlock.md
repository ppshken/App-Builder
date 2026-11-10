# Owner-managed account login unlock

Central management > Accounts and Builder includes a key-icon unlock button per account. Confirmation explains scope. Active account throttles appear as a login-locked badge with expiry tooltip. Existing global login throttle is displayed separately when active.

POST /api/users op unlock_login validates the target ID and account, and requires the existing active Builder-owner authorization inside the transaction. It deletes only tokenHash('user:'+id) from _auth_attempts. It does not alter passwords, account activation, permissions, sessions, other accounts or the global limiter. Existing 5/15-minute account and global policies are unchanged (AUD-002 remains deferred). A global limit can still prevent login after account unlock; UI explicitly explains this.

The operation records login_unlocked in the existing usage log, with administrator actor and target user ID. No credentials or attempt hashes are exposed in the overview.

Validation:
- Regression failed before implementation: .test-data/unlock-before.log.
- Full unit suite: .test-data/unlock-unit.log, 548 tests / 541 passed / 7 skipped / 0 failed.
- Production-build browser/API: .test-data/unlock-browser.log, five failures lock login, cancellation preserves lock, owner unlock permits correct-password login, non-owner API denied.
- Existing permissions suite passed: .test-data/unlock-permissions.log.
- Build passed: .test-data/unlock-build.log.

No production changes or deployment. If all Builder owners are locked and no administrator session remains, this authenticated UI is unavailable; infrastructure recovery is a separate procedure.
