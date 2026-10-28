# Time / Phone / Email / URL columns

Available in Data → table → columns → type, including computed columns. All four use SQLite TEXT; no migration or conversion of existing user columns runs automatically. New metadata is recognized by schema validation, backup restore and cloning through the shared SQLTYPE registry. Existing Text columns can use the conversion preview/copy flow.

| Type | Input / stored value | Display |
| --- | --- | --- |
| `time` | Time picker with seconds; `09:05` → `09:05:00`, range `00:00:00`–`23:59:59` | `HH:mm:ss` |
| `phone` | Tel keyboard; trim/remove spaces, parentheses and dashes; keep leading zeros and optional leading `+`; 3–15 digits | Click to call with `tel:` |
| `email` | Email keyboard; common ASCII mailbox syntax, local part <=64, total <=254; preserve local-part case, lowercase domain | Click to compose using encoded `mailto:` recipient |
| `url` | Absolute HTTP(S), <=2048 after normalization; URL canonicalization/encoding; no credentials/control characters/backslashes | Open a new tab with noopener/noreferrer |

Phone validation is structural, not country-specific verification. It does not infer country codes or extensions. Email validation does not check DNS/mailbox deliverability and does not support all RFC quoted/international local-part forms. URL fields are links only; validation never fetches the destination. Intranet/localhost HTTP(S) URLs are allowed. Relative links, javascript/data/ftp schemes and credential-bearing URLs are rejected.

Optional blank strings/whitespace become NULL; required/Valid_If/Editable_If, formulas and row permissions continue through the normal record validation path. Non-string numbers/booleans/objects/arrays are rejected for these four types, including empty arrays. The four types support unique values; normalization occurs before duplicate checks. They are not added to the list of supported Key types.

Phone formatting is canonical, so `081-234-5678` and `081 234 5678` both store `0812345678`. `+66812345678` and `0812345678` remain different because the system does not infer locale. Email local parts retain case; uniqueness is exact after domain normalization.

## Time formulas and conversion

Default expression for current Thailand time: `TEXT(NOW(), "HH:MM:SS")`.

`[end_time] - [start_time]` returns Duration; blank typed Time operands return blank. Time has no date or timezone. Crossing midnight cannot infer the following day: use DateTime for shifts spanning dates. Duration continues to support signed values and hours above 23; Time does not.

DateTime → Time conversion extracts Thailand-local clock time and warns that the date is discarded. Conversion preview rejects invalid text and leaves originals untouched. Time → DateTime does not invent a date.

## Forms and links

Builder/runtime/inline forms use native `time`, `tel`, `email`, `url` controls, with autocapitalization/spellcheck disabled for contact fields. Native picker presentation depends on browser, while stored Time is always HH:mm:ss. Existing mobile input sizing and save/loading behavior are unchanged.

Lists/tables/details/related inline values render contact links through a validated shared href helper; unsafe legacy values are plain text rather than executable links. Clicking a link does not also trigger its containing record's navigation. PDFs retain escaped textual values.

## Excel

Export stores phone/contact/time values as strings, preserving leading zeros. Imports accept Time strings, time-formatted Date values (use their wall-clock portion), or day fractions `0 <= value < 1`. Other numeric values are not interpreted as clock times. Phone cells must be text; a numeric Excel cell cannot reliably recover a lost leading zero and is rejected. The column guide documents expected formats. Imported invalid values follow the existing all-or-nothing validation/commit flow.

## Tests

`node scripts/test.cjs` covers normalization, bounds, unsafe links/headers, nulls/types, Time formulas, conversion warnings/rollback, Excel time/phone and atomic import. `node scripts/integration.cjs scalarfields` covers API writes/uniqueness, invalid Action rollback, mobile/desktop forms, Duration, links, Inline, column editor, Excel and PDF using an isolated DB.
