# AUD-002 — Approval gate for authentication policy

Status: PAUSED by explicit user instruction: พัก AUD-002 ไว้ก่อน. No authentication policy change is authorized at this time. Source lib/auth.ts remains unchanged relative to this repair pass.

## Confirmed reproduction

Two new regression cases fail against the current implementation: (1) 21 valid sequential logins, (2) 20 failed logins for unrelated synthetic identities followed by a valid login. Both fail because the shared bucket returns 429. No production account or database used. See evidence/AUD-002-red.txt.

## Concrete proposed change

1. Preserve the existing 5-attempt / 15-minute per-account quota and success reset.
2. Count the shared 20-attempt bucket for failed verifications only. A correctly verified password must not be rejected by this shared failure bucket or add to it.
3. Bound expensive password verifications to 4 in flight per process; release slots in finally on success, failure and exceptions. Do not start an unbounded waiting queue.
4. Keep generic login failures, inactive-account checks, expiry and atomic quota updates. Preserve first-owner setup throttling as a separate path.
5. Do not trust arbitrary X-Forwarded-For or infer a real client IP without an approved proxy configuration.
6. No schema migration, credential change, user/session deletion, new dependency, proxy change or production deployment.

## Security tradeoff / remaining risks

The shared failure budget can no longer reject a valid password before verification. Password verification therefore needs the explicit bounded concurrency gate. The limit is process-local, not a distributed/per-IP anti-abuse solution; real proxy/IP limits remain a separate deployment decision. Individual account lockout after repeated failures remains as before.

## Acceptance tests before declaring Passed

- 21+ successful requests permitted without shared failure quota exhaustion.
- Global failures for unrelated identities do not block a legitimate correct login.
- Per-account failure limit, expiry, success-after-prior-failures and generic errors preserved.
- Concurrent verification capacity is bounded and released after errors; account/password-change flow and normal sessions still pass.
- Existing auth/account/permissions unit tests and relevant API suites run with an isolated DB.

## Why approval is requested

The user's current instruction explicitly requires waiting for approval for high-risk changes. This proposal changes the public authentication throttling policy, so it is held separately from AUD-001 rather than silently weakening/removing the global protection.
