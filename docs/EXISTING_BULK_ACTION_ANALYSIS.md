# Bulk Actions — architecture and MVP contract

Inspected 2026-10-30. No production database or deployment changes are authorized.

## Existing integration points

| Module | Existing implementation | Bulk integration |
|---|---|---|
| Grid | `app/components/RuntimeTable.tsx`: server pagination, filters, sorting, renderedGroups | Explicit primary-key selection, header selects displayed page only |
| View metadata | `lib/view-display.ts`, `lib/view-api.ts`, `ViewDisplayEditor.tsx` | Optional `bulk_actions` in existing display JSON; disabled by default |
| Registry | `lib/action-config.ts`, `lib/automation.ts:actions` | Reuse original action name; only `kind=set` |
| Execution | `lib/automation.ts:executeAction` | Call unchanged executor per row; snapshot/sequential expression semantics unchanged |
| Write path | `lib/data-write.ts:writeRecord` | Existing validation, reference handling, audit, change events and transactions |
| Identity / RLS | `lib/auth-api.ts`, `permissions.ts`, `row-access.ts`, `applications.ts` | Authenticate request, resolve application, refresh actor/access before each row |
| Concurrency | `lib/row-version.ts`, `lib/view-records.ts` | Require the existing `__version` captured when selecting each ID |
| Automation | `lib/workflows.ts` | Inspect enabled update hooks of the target table: allow only synchronous same-row set steps; never suppress hooks or silently permit external effects |
| Read-only sources | `lib/external-storage.ts` | Live/Cached sources remain ineligible |
| Tests | `scripts/test.cjs`, `scripts/integration.cjs`, Playwright fixtures | Isolated SQLite and browser tests; never use production data |

## Action definition and invariants

`RowAction = {name,label,table_name,kind,values,condition_expr,confirmation,config}`.
`values` maps real column names to expressions; `config.value_mode` controls snapshot/sequential evaluation. `executeAction(name,id,email,slice)` reloads the row, checks row rights, slice and condition, evaluates expressions and calls `writeRecord` inside a transaction. Errors roll back that row. Bulk does not interpret update expressions itself.

Other kinds (`delete`, `add`, `copy`, `grouped`, `automation`, forms, navigation, URLs and communication) are excluded, including `edit_form`, which opens a form rather than executing an update. This resolves the contradictory Delete bullet in phase 3 in favor of the mission and acceptance criteria.

## MVP safety and UX

- Saved Table View must opt in and allowlist original Action names from its own table. Backend rechecks every request and row. Unsaved preview configuration cannot authorize writes.
- IDs are explicit positive integers; header selection is only displayed rows. Selection survives page/sort changes, resets on search/filter/group/source/view/app/workspace changes. Manual reload keeps captured versions so stale rows conflict rather than silently overwrite.
- Hard cap 100 selected rows; sequential execution, one active batch per actor/application and four per database, bounded request size and batch deadline.
- Per-row outer transaction commits update and durable result together. Idempotency keys are scoped to actor/application; same key with a different payload conflicts. Retry the same request after uncertain transport failure. Completed successes are never rerun by replaying that key.
- Each row uses fresh database data, update rights, Action availability and captured row version. Partial failure preserves failed IDs; conflicts require review/reselection.
- Confirmation is mandatory in MVP; toolbar supports top/bottom placement. Result summaries expose safe codes, never raw database errors or row contents.
- Durable operational ledger is not an app definition, is not cloned and must not replay after restore. A fresh persistent data epoch after Restore rejects old pending requests, including requests whose original rows happen to have identical versions. Backup staging discards old receipts and regenerates the epoch.

## Milestones / evidence

1. Architecture discovery complete (this document).
2–7. Selection, Builder controls, backend orchestration, results, security and automated tests: see `docs/bulk-actions/IMPLEMENTATION.md` and `docs/bulk-actions/TEST_RESULTS.md`. No claim of runtime correctness is made from inspection alone.

## Explicit limitations

Enabled update hooks are inspected. Only synchronous (`execution=save`) direct same-row `set` steps are eligible. Background hooks, external steps, parent references and composite hooks are excluded; ordinary hooks are never suppressed. Atomic batches, all-database selection, cross-source actions and background distributed jobs are outside MVP.
