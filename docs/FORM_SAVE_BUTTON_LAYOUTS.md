# Form save button layouts

App settings → ค่าตั้งต้นรูปแบบหน้าจอ → ฟอร์ม → รูปแบบปุ่มบันทึกข้อมูล.

- ปกติ (`normal`): existing bottom action bar, right aligned.
- แนวตั้ง (`vertical`): full-width save above cancel.
- แนวนอน (`horizontal`): cancel and save share the row equally.
- ด้านบน (`top`): actions remain below the page header and above the scrolling form.
- ปุ่มลอย (`floating`): rounded actions at the lower right; form has bottom clearance so final fields remain reachable.

Stored as `display_defaults.form.form_save_layout`. A form View can override with `display.form_save_layout`; missing values inherit app settings, then `normal`. Inline forms use their configured form View and the same inheritance. Existing save/validation/disabled/loading, cancel/unsaved guards and after-save behavior remain on the existing handlers. Layout uses CSS without adding a second page header or opening animation.

Preview reflects the layout immediately before saving settings. Both runtime screens and Builder data editor dialogs use the same layout classes. Old saved settings need no migration.

Validation: unit tests cover allowed/invalid values and inheritance; `node scripts/integration.cjs formsavelayout` checks all five modes on 390px/1440px screens, saves, per-View override, inline form return/linking, preview and horizontal overflow.
