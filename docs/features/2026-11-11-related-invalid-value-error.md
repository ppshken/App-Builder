# Invalid value error for child-list Valid_If

Location: **Data → parent table → รายการที่เกี่ยวข้อง → ตั้งค่ารายการลูก**. The plain-text **Invalid value error** field appears immediately below the child-list Valid_If editor. It accepts up to 1,000 characters. A blank value retains the existing default message.

Example: `COUNT([_THIS]) = 7`, with message `กรุณาเพิ่มรูปภาพให้ครบ 7 รายการก่อนบันทึก`.

## Behavior and implementation

- Metadata field `part_invalid_value_error` is independent of the Ref column's existing `invalid_value_error`; editing one does not overwrite the other.
- `RelatedPartSettings` loads/saves the setting through existing column metadata APIs. `PartOfForms` displays it for a false child-list Valid_If.
- `assertParentParts` uses the same message when backend validation rejects the parent/child transaction. It uses the existing safe `InvalidValueError` class so English messages are retained as authored rather than replaced with generic internal-error text.
- Formula syntax/evaluation errors keep their original diagnostics. The new message does not hide malformed formulas, change permission checks, alter the Valid_If formula or relax transaction rollback.
- Nullable metadata migration follows existing initialization and per-app configuration schema propagation. Column conversion preserves the setting. Empty values do not change existing shared-table schema hashes.
- No production database was opened for verification and no deployment was performed. Migration code was exercised only on isolated/in-memory test databases.

## Evidence

- `.test-data/related-error-unit.log`: 560 tests, 553 passed, 7 skipped, 0 failed. New cases cover message retention, type/length validation, idempotent metadata migration and shared-table hash compatibility.
- `.test-data/related-error-build.log`: production build passed.
- `.test-data/related-error-complete-dev.log` and `.test-data/related-error-relatederror-production.log`: API + browser tests passed on isolated databases. They verify placement/persistence, Thai/English custom errors, independent Ref message, fallback, formula diagnostics, failed-save rollback, then adding the required children and successfully saving the form.
- `.test-data/related-invalid-message-mobile.png`: synthetic mobile screenshot of the inline custom error and failed-save notification; not a physical iPhone test.

Related implementation: `lib/columns.ts`, `lib/schema.ts`, `lib/db.ts`, `lib/metadata.ts`, `lib/part-of-config.ts`, `lib/part-of-records.ts`, `lib/related-part-settings.ts`, `lib/shared-table-columns.ts`, `lib/column-conversion.ts`, `app/components/RelatedPartSettings.tsx`, `app/components/PartOfForms.tsx`.

Additional production regressions passed: `.test-data/related-error-partof-production.log`, `.test-data/related-error-sharedtables-production.log`, `.test-data/related-error-conversion-production.log`. The final focused suite also copies/converts the Ref column and asserts that both distinct error messages survive: `.test-data/related-error-relatederror-final-production.log`.
