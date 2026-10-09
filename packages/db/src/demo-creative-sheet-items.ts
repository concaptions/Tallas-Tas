import { sheetRowFromBrief, type CreativeSheetItemListRow } from './creative-sheet-items';
import { demoBriefs } from './demo-data';

/**
 * The Creative Sheet's demo rows: the seeded Niagara briefs, read through the same
 * `sheetRowFromBrief` the query layer uses (single-source cutover, 2026-10-09). One row per brief,
 * newest edit first — the order `listCreativeSheetItems` returns — so the fixtures and a seeded
 * database are row-for-row identical and a test can compare the two directly. Nothing is restated
 * by hand: a brief fixture's status, QA flags and ratios ARE the sheet row's.
 */
export const demoCreativeSheetItems: CreativeSheetItemListRow[] = [...demoBriefs]
  .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
  .map(sheetRowFromBrief);
