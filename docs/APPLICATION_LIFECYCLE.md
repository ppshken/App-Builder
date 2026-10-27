# Application lifecycle

The My Apps card uses the app's configured icon/image and accent color. Management tools appear only when `can_manage` is true. The API checks the same application-specific permission independently.

## Clone

POST `/api/applications` with `{op:"clone",id,label,mode:"new"|"shared",include_data:false}`.

- New tables: creates independent schema, rewrites table identifiers in Ref, formulas and app definitions. Empty by default; optionally copy rows with existing IDs. Copying rows requires export permission on all connected source tables.
- Shared tables: uses the original tables and preserves dataset permission ceilings. Changes to shared rows are visible in both apps.
- Copies Views, Actions, settings, PDF templates, Automation definitions and local role definitions. New creator receives management access.
- Does not copy user assignments, jobs, releases/history or individual user setting values. Automation definitions are disabled until reviewed and enabled.
- New table names are generated to avoid collisions. All schema/config/data changes happen in one immediate transaction; failures roll back the new app and tables.
- Media references retain existing uploaded assets; cloning does not duplicate image/file bytes or create a separate physical database file.

## Delete

DELETE `/api/applications?id=...` requires management access and confirmation in the UI. Removes the app and its configuration, memberships and grants, but retains business tables and rows. Owned tables move to central/default ownership; other apps' shared dataset connections remain intact.

Default app cannot be deleted because it supplies configuration schema templates. Apps with queued/running Automation jobs cannot be deleted until jobs complete or are canceled. API takes an automatic schema backup before clone/delete. Restoring a deleted app uses backup restore.

## Validation

`node scripts/test.cjs` includes lifecycle transaction, Ref/data isolation, export ceilings, permissions, disabled Automation, blocked jobs and formula/config remapping coverage.
`node scripts/integration.cjs applifecycle` covers clone/delete dialogs, card updates and mobile overflow with an isolated SQLite database.
