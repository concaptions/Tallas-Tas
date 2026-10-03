# Dead parent lookups: twelve fields that seed nothing (2026-10-03)

Verified directly against the template base `appnaSGAgOUbJ0f9m` metadata: twelve computed fields
report `isValid: false` — Airtable itself considers them broken. They get **no `column_definitions`
row, no stored column, and no read-time formula**. This file is the record of why they are absent,
so a later reader does not mistake the omission for an oversight and "fix" it by adding twelve
columns that can never hold anything.

All twelve are on the one table the template base itself labels **`DONT USE Creative Sheet`**
(`tblGC0TxnHI7lKaNQ`) — the id that Gratsi calls the live `Creative Sheet`. Eleven have
`recordLinkFieldId: null`, meaning the record link they looked through has been deleted, so there is
no relationship left to traverse. The twelfth points at a field that is not a link at all.

| # | Field | Type | Why it is dead |
| --- | --- | --- | --- |
| 1 | `Performance (from Creative Name)` | multipleLookupValues | link deleted (`recordLinkFieldId: null`) |
| 2 | `(Internal) Product (from Creative Name)` | multipleLookupValues | link deleted |
| 3 | `Angle (from Creative Name)` | multipleLookupValues | link deleted |
| 4 | `Concepts (from Angle) (from Creative Name)` | multipleLookupValues | link deleted |
| 5 | `Elements we are Testing` | multipleLookupValues | link deleted |
| 6 | `Design File` | multipleLookupValues | link deleted |
| 7 | `Design Link URL` | multipleLookupValues | link deleted |
| 8 | `Collection` | multipleLookupValues | link deleted |
| 9 | `Platform` | multipleLookupValues | link deleted |
| 10 | `Funnel` | multipleLookupValues | link deleted |
| 11 | `Type` | multipleLookupValues | link deleted |
| 12 | `Creative Module` | multipleLookupValues | points at `Creative Name`, which is a `singleLineText` in this base, not a link — so `fieldIdInLinkedTable` is null and there is nothing to look through |

Twelve of the base's twenty-six computed fields are therefore dead, leaving **fourteen** live derived
fields across the whole parent base. An earlier audit counted all twenty-two lookups as ordinary and
never recorded that half of them are invalid, which would have produced a dozen columns that are
permanently empty by construction.

One consequence worth stating, because it is a question for Talal rather than a bug: the whole table
is named `DONT USE Creative Sheet` in the parent while Gratsi uses that same id as its live
`Creative Sheet`, and only 5 of its 17 fields carry anything. Whether that table belongs in the
parent column set at all is a product decision, recorded here and in the morning report.
