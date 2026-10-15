/**
 * Live script word count (Oct 12 ask, QA item 33, Oct 15 follow-up: SCRIPTS_SIDEBAR).
 *
 * Lifted out of `apps/web/src/app/app/creative-design/[briefId]/brief-detail.tsx` so the brief
 * sidebar (`creative-sheet-panel.tsx`) can show the same "N words" line under its own Scripts
 * table. One source, one spec, one unit test.
 *
 * Spec: whitespace-split and trimmed empties collapse to zero; the strategist reads the number
 * as `"N words"` for every count, so the caller never pluralises — `"1 words"` is accepted per
 * the original ask.
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed === '') return 0;
  return trimmed.split(/\s+/).length;
}
