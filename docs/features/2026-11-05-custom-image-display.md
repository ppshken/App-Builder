# Custom image display settings

View > Custom screen > Designer > Image now exposes:

- Fit: Cover, Contain, Fill, Scale down, and None/original pixel size.
- Position: nine horizontal/vertical anchor presets.
- Frame proportions: fixed height (existing behavior), intrinsic source ratio, 1:1, 4:3, 3:2, 16:9, 3:4 and 9:16.

Cover fills the frame and may crop; Contain preserves the complete image with possible empty space; Fill can distort; Scale down avoids enlarging smaller sources. The existing background setting can color empty image space. Existing corner radius, width, padding and shadow controls remain available.

Changes render immediately in the designer and use the same renderer in the app. Save View remains required. Fixed-height values are preserved while switching ratios; the height control appears only in fixed-height mode. Intrinsic/ratio modes allow the image node to size naturally instead of leaving the previous fixed-height parent behind.

Metadata fields on CustomNode: `imageFit`, `imagePosition`, `imageRatio`. Values are validated against shared enumerations, restricted to image nodes, and do not accept arbitrary CSS. Existing images retain Cover, centered positioning and fixed-height behavior when the fields are absent. No database migration or new dependency is required.

Validation evidence:

- Before implementation, the positive image-setting regression failed on the existing unknown-field validator (`.test-data/custom-image-before.log`).
- Unit/regression run: 473 passed, 0 failed, 7 platform skips (`.test-data/custom-image-unit.log`).
- Production webpack build: passed (`.test-data/custom-image-build.log`).
- Both browser suites passed: image settings/API checks (`.test-data/custom-image-customimage.log`) and prior designer/runtime regression (`.test-data/custom-image-custompage.log`).
- Browser assertions cover live fit/position changes, square/intrinsic/fixed/wide proportions, retained height, persisted metadata, rejected invalid API values and runtime rendering. Both designer and runtime also verify that the outer node follows the image's ratio-derived height instead of retaining the prior fixed height and overlapping subsequent content.

All mutable checks use isolated databases and synthetic image fixtures. No production deployment or database changes.
