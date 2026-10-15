import Link from 'next/link';
import { Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@tas/ui';
import { countWords } from '@tas/domain/briefs';

/**
 * One row of the Scripts table — the brief's own script, or a Meta Copywriting row written for
 * it. Shared between the brief FULL page (`brief-detail.tsx`) and the brief SIDEBAR
 * (`creative-sheet-panel.tsx`) so one component owns the Type / Script / B-roll / Instructions
 * shape and the live `"N words"` word count under every Script cell (Oct 12 QA item 33, Oct 15
 * SCRIPTS_SIDEBAR follow-up).
 */
export interface BriefScriptRow {
  readonly id: string;
  readonly label: string;
  readonly kind: string;
  readonly href: string | null;
}

export interface BriefScriptsTableProps {
  readonly scripts: readonly BriefScriptRow[];
  /** `true` when the viewer is in demo mode — the ephemeral B-roll / Instructions inputs lock. */
  readonly demo: boolean;
  /** The one-line empty state when the brief has no scripts yet. Never "not uploaded". */
  readonly emptyMessage?: string;
}

/** The empty-state copy the sidebar uses when a brief has 0 scripts (Oct-15 SCRIPTS_SIDEBAR). */
export const SIDEBAR_SCRIPTS_EMPTY_MESSAGE = 'No scripts yet. Add one above.';

/**
 * The four-column Scripts table shared by the brief page and the brief sidebar.
 *
 * On the page, the viewer edits the Script in the centre prose column and the row's label
 * updates live from the controlled textarea state; on the sidebar the viewer reads the stored
 * `scriptContent` as a static row (editing goes to the full page). Either way the word count
 * reads from the row's `label` so the only "live" wiring is the one in `brief-detail.tsx`.
 */
export function BriefScriptsTable({ scripts, demo, emptyMessage }: BriefScriptsTableProps) {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface">
      <Table data-slot="brief-scripts-table">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="px-3">Type</TableHead>
            <TableHead className="px-3">Script</TableHead>
            <TableHead className="px-3">B-roll</TableHead>
            <TableHead className="px-3">Instructions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {scripts.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={4} className="px-3 py-6 text-center text-sm text-text3">
                <span data-slot="brief-scripts-empty">
                  {emptyMessage ??
                    'No script yet. The creative’s script and its Copywriting rows appear here.'}
                </span>
              </TableCell>
            </TableRow>
          ) : (
            scripts.map((script) => (
              <TableRow key={script.id} data-slot="brief-script-row">
                <TableCell className="px-3 py-1.5 align-top text-text3">{script.kind}</TableCell>
                <TableCell className="max-w-[480px] px-3 py-1.5 align-top text-text2">
                  <div className="truncate whitespace-pre-wrap" data-slot="brief-script-text">
                    {script.href === null ? (
                      script.label
                    ) : (
                      <Link href={script.href} className="underline-offset-2 hover:underline">
                        {script.label}
                      </Link>
                    )}
                  </div>
                  {/*
                    Oct 12 ask (QA item 33): live word count under every Script cell.
                    The strategist watches this update as they type in the centre column.
                   */}
                  <div data-slot="brief-script-word-count" className="mt-1 text-[11px] text-text3">
                    {countWords(script.label)} words
                  </div>
                </TableCell>
                <TableCell className="px-3 py-1.5 align-top">
                  {/*
                    B-roll — a plain per-row input until the global B-roll library ships
                    next sprint. Not posted with the form, so no `name` attribute.
                   */}
                  <Input
                    type="text"
                    aria-label="B-roll"
                    data-slot="brief-script-broll"
                    readOnly={demo}
                    className="h-8 text-xs"
                  />
                </TableCell>
                <TableCell className="px-3 py-1.5 align-top">
                  {/* Instructions — same per-row ephemeral input shape as B-roll. */}
                  <Input
                    type="text"
                    aria-label="Instructions"
                    data-slot="brief-script-instructions"
                    readOnly={demo}
                    className="h-8 text-xs"
                  />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
