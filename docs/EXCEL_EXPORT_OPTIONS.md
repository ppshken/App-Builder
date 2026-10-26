# Excel export permissions and reference values

Users and permissions > Roles > Edit permissions now has an Export Excel flag for each table. Read permission is also required. Owner and builder roles retain full access. Other roles default to no export after migration and must be granted explicitly. The server checks the grant on every data download; hiding the UI is not the access control. Older role-update clients that omit the export field preserve its current value; new roles default to false. Existing row read rules apply to exported records and reference names.

The Excel dialog supports reference formats ID/Key (default), names, and both. Ref stores internal row IDs; Enum/EnumList may store business keys. Both retains the original values and adds companion __label columns; collisions receive a numbered suffix. Labels resolve using target table labels and current user permissions. Other column values are unchanged. Template files remain ID-based and empty. Use ID/Key exports for importing back; readable and companion-label exports are intended for reporting. Array values remain JSON.

API: GET /api/excel/:table?references=ids|labels|both. Unknown values are rejected. Import permissions still use create/update grants; this feature adds no new import permission.

Tests: node scripts/integration.cjs exceloptions reads real workbook cells, verifies denied exports, row policies, protected target labels, EnumList names, header collisions, and UI permission revocation. node scripts/test.cjs covers permission defaults and validation. All fixtures are isolated from user data.

Name-only exports also use display labels as column headings, including the internal ID heading. Duplicate display labels receive numbered suffixes. The dialog separates import and export into tabs only when both are allowed; export controls are absent for import-only accounts and the toolbar button is hidden for read-only accounts without export permission.

The export dialog defaults to all columns. Custom mode offers checkboxes, select-all and clear-all; at least one column is required. API parameter columns is a comma-separated allowlisted set of system column names, including optional id. Output follows table column order. Companion names in both mode follow selected reference columns automatically. Only selected columns appear in the data and guide sheets; virtual calculations include required dependencies without exporting those dependencies. Templates keep the full ID-based schema.
