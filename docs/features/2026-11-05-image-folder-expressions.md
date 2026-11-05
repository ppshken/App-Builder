# Row-based image folder expressions

The image column's existing `image_path` setting now accepts either a literal relative path or a formula interpreted by the existing expression engine. No database structure change is needed.

Examples:

```text
products/photos
[inspection_id]
CONCATENATE("inspection/", [inspection_id])
CONCATENATE("inspection/", [id])
```

The column editor includes formula completion and the existing expression assistant. An empty setting retains the application's default folder. Expression settings are syntax-checked when metadata is saved. Literal paths remain backward compatible; formulas start with a column reference, quoted text, function call, or `=`.

For deferred form images, resolution occurs inside the existing save transaction after the parent/child rows, defaults and form-saved Action have been applied. This supports generated row IDs and automatically assigned child Ref values. The resolved folder is recorded in the media catalog in both database-only and database-copy modes. Disk copies use UUID filenames and are created after folder resolution; existing images are not moved when a setting changes.

Direct image uploads can provide a `values` JSON form field as folder expression context. This only controls the validated upload location and does not write row data or confer row permissions. Table upload permissions and expression cross-table read permissions remain enforced. A dynamic path without row context is rejected with guidance to save through a form.

Security: the evaluated result must be one nonempty string or finite number and must pass the existing relative-path validator (maximum 160 characters, English letters/digits/underscore/hyphen segments). Absolute paths, traversal, empty segments and reserved device names are rejected. Invalid paths roll back the form transaction and uploaded media. Folder expressions never execute JavaScript or SQL.

The scope is image columns only; attachment file paths are unchanged. Unknown or missing row values produce a validation error rather than silently placing files in a common folder. Formula settings can be up to 2,000 characters. Optional disk copies still require application image storage to be set to database plus copy.

## Verification evidence

- Regression first reproduced: `.test-data/image-folder-before.log` (dynamic parent/child folder test failed on the previous literal-only validator).
- Unit and regression tests: 469 passed, 0 failed, 7 platform skips (`.test-data/image-folder-after.log`).
- Production webpack build: passed (`.test-data/image-folder-build.log`).
- Production browser/API tests: both suites passed (`.test-data/image-folder-deferredimages.log` and `.test-data/image-folder-filebrowser.log`).
- Test additions are in `tests/deferred-images.test.cjs` and `tests/deferred-images-browser.cjs`: generated parent/child keys, persisted folder/copy paths, unchanged old images, literal/default compatibility and unsafe-path rollback.

Only isolated test databases are used. No production database mutation or deployment is part of this change.
