# AUD-003 — Framework security migration approval

Status: RESUMED and implemented on 2026-11-02 after the user's explicit request to fix dependencies. See [migration results and remaining deployment gates](../2026-11-02-dependency-security/RESULTS.md). The previous pause and proposal below describe the historical approval state before that request.

## Confirmed evidence, 2026-10-29

Read-only npm audit repeats 2 production vulnerable packages: Next critical, PostCSS high. Installed Next 14.2.15 / PostCSS 8.4.31. Application exploitability was NOT TESTED. This is not a claim of successful compromise.

## Concrete proposed scope

- Pin Next 16.4.3 (current audit-recommended fixed release); its registry metadata resolves PostCSS 8.5.23, outside the reported <=8.5.22 affected range.
- Pin React / React DOM 19.3.1 together and compatible React type packages; current registry latest verified by npm view. Recheck advisories immediately before installation.
- Update only required compatibility code: async cookies/headers/route params/searchParams, Next configuration (external packages and instrumentation), middleware/proxy and cache semantics where needed. Do not migrate business schema or remove features.
- Keep webpack for the initial compatibility baseline if current native modules require it; review Next 16 default bundler explicitly.
- Install/build only in an isolated working copy with synthetic SQLite databases; leave current runtime, real database, secrets, Docker volumes and deployment untouched. Record every compatibility diff separately from the other bug fixes.

## Risks and gates

This is a major framework + React migration affecting authentication, APIs, rendering and navigation, hence the user's high-risk approval requirement applies. Pinning 15.5.28 alone is insufficient for the current PostCSS finding (registry metadata still lists 8.4.31).

Required gates: updated dependency audit, strict library compilation and application typecheck, fresh production build, auth/CSRF/cross-app attachments/roles, API, workflow/PDF/Excel, PWA/cache/navigation browser regressions; Linux disposable Docker build with no real mounts. If Docker or real iPhone is unavailable, explicitly mark NOT TESTED and do not claim production readiness.

Rollback: discard isolated migration copy; no database changes or deploy. A successful local migration does not authorize production deployment.

## Sources

- [Next support policy](https://nextjs.org/support-policy): 14 unsupported; 16 Active LTS.
- [Vendor October security release](https://nextjs.org/blog/nextjs-security-update-october-14-2026).
- [Upgrade API changes](https://nextjs.org/docs/app/guides/upgrading/version-15).
- Local evidence: read-only npm audit and npm view for next@16.4.3, next@15.5.28, react and react-dom; Node v22.12.0.
