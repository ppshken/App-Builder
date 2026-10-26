# Nested View grouping

View settings store up to five distinct group levels in display.group_by (column, direction), using existing display_json storage. Legacy group_column/group_dir remain the fallback; the editor mirrors the first configured level for compatibility. Column rename/delete updates group_by through changeDisplayColumn. Slice and Inline restrictions are checked server-side.

Configured runtime table/list Views show a group tree at desktop widths and sequential group selection below 768px. Counts include all currently visible rows after search, filters, Slice, and row permissions. The runtime requests the existing all=1 read API and paginates the selected group locally. This requires the full matching result in memory; very large tables may benefit from a future server-side aggregation endpoint. Only the selected page is rendered. Legacy single-group Views retain their previous behavior until edited into the new configuration.

Related Inline lists keep their existing server pagination and show nested paths within the current page. SQL orders by every stored group level before normal row sorting. Pending form rows use the same ordering. Full group navigation applies when opening the Inline View as a full runtime page.

Tests: node scripts/integration.cjs nestedgroups; node scripts/integration.cjs inlinehorizontal; node scripts/integration.cjs backstate; node scripts/test.cjs. All integration tests use isolated databases.
