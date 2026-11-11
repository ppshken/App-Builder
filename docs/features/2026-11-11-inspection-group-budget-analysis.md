# Inspection group calculation budget investigation

User location: Inspection New V2 → list_inspection → inspection_group. The matching local metadata is app **New Inspection V2**, physical table `c_b75a12b9_13_list_inspection`, Ref column `inspection_groups_id` (หัวข้อการตรวจ).

## Confirmed mechanism

Both Default expression and Valid_If contain a SELECT of eligible inspection groups with a nested SELECT of groups already used for the current inspection. The inner selection is evaluated again for each candidate group. Its filter depends on the current form's inspection_id, so the same set is repeatedly built.

The interpreter limits a cross-table expression to 100,000 evaluated nodes (`lib/expression.ts`, run/SELECT). The error is a computation budget guard. It is separate from the 10,000-row dataset limit and 64-level nesting guard. Budgets reset per expression evaluation; this is not a count of all columns in the system.

## Runtime evidence and limits

Local database inspection used `better-sqlite3` with `readonly: true, fileMustExist: true`; only metadata and aggregate counts were read. No user records were printed or copied into test fixtures. The local matching tables contain 50 groups and 344 inspection-detail rows. This is a local workspace snapshot, not a verified count from the live production server.

`.test-data/inspection-group-budget-repro.cjs` evaluates the actual stored formulas against synthetic data using the compiled shared interpreter:

| Synthetic groups | Synthetic detail rows | Default | Valid_If |
| --- | --- | --- | --- |
| 50 | 100 | Passed | Passed |
| 50 | 344 | Passed | Passed |
| 50 | 700 | Computation-budget error | Computation-budget error |

Evidence: `.test-data/inspection-group-budget-repro.log`. The crossover depends on the number of eligible groups and condition branches; 700 is a reproduced fixture, not a universal production threshold.

## Proposed targeted remedy — not applied

Compute the used-group IDs once for the current inspection, then reference that result from the outer group-selection conditions. An optional hidden calculated List column with no Ref table can hold:

```text
SELECT(
  c_b75a12b9_13_list_inspection[inspection_groups_id],
  [inspection_id] = [_THISROW].[inspection_id]
)
```

In both expressions, replace only that repeated nested selection with `[_THISROW].[used_inspection_groups]`. Keep eligibility, duplicate prevention, the edited row's current choice and default-first-choice behavior unchanged. The existing per-row calculation resolver caches calculated column values within its pass.

`.test-data/inspection-group-helper-proof.cjs` tests this transformation on synthetic new-parent, existing-parent and edit scenarios. At 344 rows it matches the original results. At 700 and 10,000 rows it evaluates without the original budget error and retains the expected Valid_If choices, including keeping the edited choice. Evidence: `.test-data/inspection-group-helper-proof.log`. This is a formula-level proof, not an end-to-end migration or production rollout.

No source execution logic, limits, stored formulas, metadata or application data were changed. A generic interpreter optimization or server-side filtered selection is a separate broader change; increasing the budget alone would retain the repeated work.
