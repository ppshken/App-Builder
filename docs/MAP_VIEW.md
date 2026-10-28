# Map View presentation

Configure app defaults at การตั้งค่าแอพ > ตัวเลือกขั้นสูง > ค่าตั้งต้นหน้าจอทั้งหมด > แผนที่. Configure a particular View at View > รูปแบบหน้าจอ. The View overrides only the keys explicitly edited; ใช้ค่าตั้งต้นของแอพ clears presentation overrides while keeping the table's coordinate/title/image mappings.

Presentation options:
- Layout: map next to list, map above list, or map only. Narrow containers, including dashboard panels, stack the split layout automatically.
- Map tone: standard, muted, or grayscale. Tone is a local CSS filter on the existing OpenStreetMap tile layer, not another map provider or a satellite map.
- Marker: pin, dot, or sequential number; size 8–20; custom hex color or the app's theme accent.
- Corner radius 0–24, coordinate visibility, summary visibility, and mouse-wheel zoom.
- Existing zoom, height and automatic fit settings remain available.

Controls and cards use theme colors, including dark mode. Click a list item's name to locate it and open its popup; click its arrow or the popup detail button to open the record. The list pages 25 records at a time. Marker numbers are positions in the current result, not business IDs. Search and the existing authorized special-view data endpoint still determine available records. Invalid/missing coordinates are excluded and counted. Fit and zoom controls do not request device location.

Map creation is independent of changing callback identities. Resizing invalidates Leaflet size without resetting a user's chosen viewport. The map, tile listeners and resize observer are disposed on teardown; navigation back can retain the parent map. Motion respects reduced-motion preferences when focusing a location. Image and text popup content use DOM APIs and authorized local image paths.

The app-default preview uses three sample locations with the actual Map component, so presentation changes appear immediately. Preview tiles require internet; no sample records are saved. Live map tiles also require internet. If tiles fail, existing markers and list actions remain available and Retry rebuilds the map.

Verification: isolated unit validation and browser tests cover global defaults, explicit View overrides, inherited settings after editing one View option, live defaults preview/save, mobile/desktop layout, pin/dot/number styles, popups/details, focus/fit/zoom, paging, empty/invalid coordinates, dark-mode surfaces and failed tile loading/retry. Tests stub tiles for deterministic screenshots; physical-phone touch testing remains separate.

## Embedded table/list View

View แสดงข้อมูลใต้แผนที่ selects a non-inline table/list View of the same underlying table, or the original position list. The selected View supplies columns, ordering and styling. It shares Map search, hides its duplicate heading/search/pagination, and combines its own Slice with the Map Slice and valid-coordinate subset. Opening a row uses the normal detail navigation. Hidden or unauthorized child Views fall back to the standard position list. The View binding is per Map View, not an app-global default. Deleting the selected child View or changing its table/kind is blocked until the binding is removed.

The repeated Map page heading and local reload control are omitted; the app header identifies the page and retains its global reload action. The Map search uses the shared View search styling. Desktop navigation highlights the committed visible route rather than a stale table screen callback; special views also report their current screen name for preview context.

Desktop details preserve the originating Map, Dashboard, chart, calendar, custom page or table as the left background. Special-page roots participate in page-stack resolution and the existing bounded route cache; returning from a detail reuses the retained page. Embedded Dashboard row navigation records the Dashboard as its source, while explicitly expanding a child View still navigates to that child. The menu and main header follow the actual source, and detail breadcrumbs do not insert a duplicate Dashboard trail above the retained background.
