# Barcode / QR fields

In Data > table > columns, enable **สแกน Barcode / QR** on a physical Text or Ref column. Existing columns default to disabled. Changing to another type or a virtual column clears the option.

- Text receives the literal scanned string, including leading zeros. Normal field validation still applies.
- Ref matches the referenced table's explicit business Key, using that Key's normal value normalization. It does not fall back to internal ID or Label. A unique, readable match is required. The form also checks Valid_If before selecting it; ordinary save permissions and validation still apply.
- Users can continue typing or selecting manually. Scanning does not save the form automatically.

The scanner offers a rear-camera preference, local image decoding, and manual code entry. Camera access requires HTTPS or localhost and browser permission. On an HTTP LAN address, use image/manual entry or configure HTTPS. Images are decoded locally, not uploaded; only the extracted Ref code is sent for lookup. Image limits are 10 MB and 16 megapixels.

Codes must be nonblank single-line strings of at most 4096 UTF-16 code units, without ASCII control characters. QR URLs remain literal values and are never opened automatically. GS1 application identifiers are not parsed into separate fields. Supported formats depend on the bundled ZXing multi-format decoder.

The decoder loads only when opening the scanner. Closing, successful scanning, leaving the form, or hiding a retained screen stops camera tracks. A late camera permission response is also cleaned up. Reference requests are cancelled on close.

Metadata migration uses the existing backup-before-migration mechanism and defaults scan_enabled to 0. No business data rewrite is required.

Verification: unit tests cover metadata migration and permissions; browser tests decode actual QR and EAN-13 images and exercise a simulated camera, cancellation, delayed camera permission, Escape, Ref lookup beyond the first 500 options, Valid_If, and row access restrictions. Physical iPhone/Android camera testing remains a device acceptance check.
