# Central table links and source-app grouping

## Root cause
Central dataset grants created legacy _application_datasets connections without _table_overlays. Tables API marked these shared, but the column editor selected the managed shared UI only when overlay_configured was true. Thus enabling Read could expose the legacy/native column editor.

## Changes
- setApplicationDataset initializes managed metadata and the source-share ceiling atomically when an owner explicitly saves a readable connection without an overlay. New connections use physical columns only; source virtual columns are not imported. Existing managed settings are preserved.
- Explicitly upgrading an existing legacy connection snapshots its pre-existing source virtual columns into app-local virtuals, preserving formulas/views rather than silently removing them. These retained formulas can be edited locally without changing source metadata. Physical-name collisions and creation of new virtuals with source names remain prohibited.
- Existing source-clone authorization applies to these managed connections as well: a shared clone requires source-owner app management. The lifecycle regression now verifies denial before providing that prerequisite, then verifies the existing clone behavior.
- SharedTableDialog groups visible entries by source app ID, displays source app name and per-group count, and keeps search, cross-group multiselection, Ref validation and maximum batch unchanged. Disconnect selection uses the same grouping.

## Verification
- .test-data/central-link-before.log: regression fails before the implementation because central Read did not create an overlay.
- .test-data/central-link-unit.log: 452 passed / 0 failed / 7 platform skips. Includes new connection physical-only metadata, explicit legacy upgrade, local formula editing and source preservation.
- .test-data/central-link-sharedtables.log: browser/API suite verifies group headings and responsive picker geometry, centrally connected table shared/configured flags, shared column editor scrolling, rights, import, schema regeneration, source isolation and revocation.
- .test-data/central-link-approles.log: app-role suite passes with recipient formula explicitly defined locally; confirms upstream virtual field absent on new central connection, while per-role formulas and row rules continue to work.

## Usage and limits
New readable connections use managed shared settings immediately. Existing legacy links upgrade on the next explicit readable-permission save; there is no bulk production metadata migration. To upgrade an existing link, change a permitted checkbox and restore the intended setting, then refresh Data. No rows are copied and source columns are unchanged. Production and deployment untouched. Physical iPhone not tested.
