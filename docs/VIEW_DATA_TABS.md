# Data tabs for table and list Views

In View > รูปแบบหน้าจอ > แท็บข้อมูล, select one stored scalar column, such as Status. Select ไม่แสดงแท็บ to disable. This is a per-View setting; existing Views remain unchanged.

Distinct readable values appear as compact chip buttons below search. ทั้งหมด clears the tab selection while keeping search and other filters. Each selection filters by the stored value and resets pagination to page 1. Tabs combine with existing dropdown filters, advanced filters, Slice and related scope using AND. They remain available when the current result is empty because their options do not depend on other selected filters or the current page.

The tabs reuse the authorized filter-options API, readable Ref/User labels and row policies. On narrow screens the chip strip can scroll horizontally inside its own container. The first 50 values appear as chips; เพิ่มเติม offers a searchable picker for larger domains, including server search beyond the first 500 values. A selected extra value is displayed as a chip. Prefer low-cardinality columns such as status or category.

The display field tabs_column participates in validation, reference tracking and column rename/removal. Virtual, array, media, long text and coordinate columns are excluded like dropdown filters. Embedded Dashboard panels retain their current navigation and toolbar behavior.

Validation covers metadata lifecycle, both table/list runtime screens, combined filters/search, zero-result recovery, pagination reset, responsive layout and Builder save. Tests use isolated databases.
