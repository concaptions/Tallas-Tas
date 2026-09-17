import type { ReactNode } from 'react';
import { StatusChip, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@tas/ui';

import { CLIENT_ACCESS_NOTE, TEAM_COLUMNS, type TeamItem } from './fields';

/**
 * The roster itself: one `<table>`, four columns, one row per person, no detail panel and no row
 * click (ticket criterion 2). A person is not a record you open here — this page answers "who works
 * on what", and editing a member is a later ticket.
 *
 * Presentational and stateless, which is what lets the design-system page mount it with plain
 * objects and see exactly what the route renders. Every string in it was resolved on the server by
 * `toTeamItem`; nothing below formats a date, labels a role or picks a tone.
 *
 * `emptyState` is rendered inside the table body rather than in place of the table, so the headings
 * stay put and the empty case is never a blank rectangle (criterion c of the page brief).
 */
export interface TeamTableProps {
  readonly items: readonly TeamItem[];
  /** Shown across all four columns when `items` is empty. */
  readonly emptyState?: ReactNode;
}

export function TeamTable({ items, emptyState }: TeamTableProps) {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface">
      <Table data-slot="team-table">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {TEAM_COLUMNS.map((column) => (
              <TableHead key={column} className="px-3">
                {column}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={TEAM_COLUMNS.length} className="px-3 py-10 whitespace-normal">
                {emptyState}
              </TableCell>
            </TableRow>
          ) : (
            items.map((item) => (
              <TableRow
                key={item.id}
                data-slot="team-row"
                data-team-id={item.id}
                data-access={item.external ? 'client' : 'workspace'}
              >
                <TableCell className="px-3 py-2 align-top whitespace-normal">
                  <span className="block font-medium text-text">{item.fullName}</span>
                  <span className="block text-xs text-text3">{item.email}</span>
                  {/*
                    PRD §10: a client sees zero internal data. If one ever appears in the roster, the
                    row states what their access actually is instead of looking like a colleague's.
                  */}
                  {item.external ? (
                    <span data-slot="client-access" className="mt-1 block text-xs text-warn">
                      {CLIENT_ACCESS_NOTE}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell className="px-3 py-2 align-top">
                  <span className="flex flex-wrap items-center gap-1">
                    {/*
                      `StatusChip` owns its own `data-slot`, so the ticket's `role-chip` hook goes on
                      a wrapper rather than on a fork of the shared primitive.
                    */}
                    {item.roles.map((role) => (
                      <span key={role.role} data-slot="role-chip" className="inline-flex">
                        <StatusChip tone={role.tone} label={role.label} />
                      </span>
                    ))}
                  </span>
                </TableCell>
                <TableCell
                  data-slot="team-brands"
                  className={`px-3 py-2 align-top whitespace-normal ${
                    item.brands.muted ? 'text-text3' : 'text-text2'
                  }`}
                >
                  {item.brands.text}
                </TableCell>
                <TableCell
                  data-slot="team-last-active"
                  className={`px-3 py-2 align-top ${item.neverActive ? 'text-text3' : 'text-text2'}`}
                  title={item.lastActiveTitle ?? undefined}
                >
                  {item.lastActive}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
