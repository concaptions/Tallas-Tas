'use client';

import { LinkedRecordsCell, type LinkedRecordRef } from '@/components/views/linked-records-cell';

/**
 * The read-only "linked records" grid cell (GRATSI-MATCH 2026-10-04): how a REVERSE link — the far
 * side of a junction or FK another table owns — reads in an Airtable-style grid. Names, never
 * counts; a real anchor where the record has a page; generated names in the mono face
 * (non-negotiable 6); past three the rest collapse into `+N` with the whole list in the title.
 */
const CONCEPTS: readonly LinkedRecordRef[] = [
  { id: 'c1', label: 'B1-Hydration-Morning Ritual', href: '/app/concepts/c1' },
  { id: 'c2', label: 'B2-Hydration-Night Wind-down', href: '/app/concepts/c2' },
];

const MODULES: readonly LinkedRecordRef[] = [
  { id: 'm1', label: 'Problem → Solution', href: '/app/creative-modules?module=m1' },
  { id: 'm2', label: 'Founder story', href: '/app/creative-modules?module=m2' },
  { id: 'm3', label: 'UGC testimonial', href: '/app/creative-modules?module=m3' },
  { id: 'm4', label: 'Price anchor', href: '/app/creative-modules?module=m4' },
];

const ROWS: readonly {
  readonly label: string;
  readonly records: readonly LinkedRecordRef[];
  readonly mono: boolean;
}[] = [
  { label: 'generated names — mono, linked', records: CONCEPTS, mono: true },
  { label: 'plain names — overflow past three', records: MODULES, mono: false },
  { label: 'nothing linked — the dash', records: [], mono: false },
];

export function LinkedRecordsCellStory() {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface">
      <table className="w-full border-collapse text-sm" data-slot="linked-records-story">
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.label} className="border-b border-line/60 last:border-b-0">
              <td className="px-3 py-1.5 font-mono text-[11px] text-text3">{row.label}</td>
              <td className="px-3 py-1.5 text-text2">
                <LinkedRecordsCell records={row.records} mono={row.mono} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
