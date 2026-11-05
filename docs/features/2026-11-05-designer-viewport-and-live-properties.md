# Designer viewport, live properties and hierarchy

Scope: View > Custom screen > Open designer. These are editor interactions; no app schema or runtime action semantics change.

## Controls

- Ctrl/Command + wheel over the canvas zooms the canvas around the pointer, preventing browser page zoom there.
- Shift + wheel scrolls horizontally. Normal wheel retains normal scrolling.
- Middle-button drag pans the canvas. The Pan tool enables left-button/touch dragging without selecting or dragging components.
- Zoom selector, zoom in/out and fit-to-area controls support 15–300%. Zoom and scroll positions are editor state, not saved app metadata, and do not mark the View dirty.
- An explicit world and scaled sizing box track the real page height through ResizeObserver. Extra workspace around the artboard permits panning even when the artboard fits inside the viewport.

## Live properties

PropertyInput publishes valid changes on input, without waiting for blur or Enter. Numeric draft values that are empty, non-finite or outside the control's bounds do not replace the last valid preview. Partial color codes wait until empty or a complete six-digit hex value. Other existing layout validation remains authoritative. Save View is still required to persist changes; live preview is not automatic publication.

## Hierarchy

The left panel now displays a page root, type symbols, component titles, type descriptions, direct-child counts, nested connector lines and selected-row styling. Containers can be collapsed individually; Expand All and Collapse All are provided. The component palette and hierarchy have separate scrolling areas so the palette does not consume all hierarchy space. Existing drag/reorder semantics are retained.

## Verification

- TypeScript: passed (`.test-data/designer-interactions-types.log`).
- Production webpack build: passed (`.test-data/designer-interactions-build.log`).
- All three production browser suites passed: `.test-data/designer-interactions-designerinteractions.log`, `.test-data/designer-interactions-customgrid.log`, `.test-data/designer-interactions-custompage.log`.
- New browser test covers pointer anchoring, browser-scale isolation, Ctrl/Shift wheel, middle/hand pan, viewport changes not affecting dirty state, hierarchy collapse/expand, focused live number/color updates, invalid drafts and saved values.
- Panning with an artboard narrower than the viewport is also verified. Existing suites cover nested drag/drop, undo/redo, responsive Grid, persistence, runtime navigation and mobile layouts.
- Real mouse/keyboard events are used in an isolated browser/database. Physical touch devices and OS-specific trackpad gestures are not certified by that test.

Files: `app/components/CustomPageDesigner.tsx`, `app/components/custom-page.css`, `tests/designer-interactions-browser.cjs`, integration runner registration.

No production database changes or deployment.
