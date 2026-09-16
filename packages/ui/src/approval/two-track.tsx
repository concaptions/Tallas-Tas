'use client';

import type { CSSProperties } from 'react';
import {
  CLIENT_STATUS,
  chipTone,
  internalStatusFor,
  isClientTrackOpen,
  stepState,
  type ClientStatusKey,
  type CreativeTrack,
  type InternalStatusKey,
} from '@tas/domain/state';

import { Button } from '../components/button';
import { cn } from '../lib/cn';
import { StatusChip } from '../status/status-chip';
import { StepRow } from '../status/step-row';

export interface TwoTrackApprovalProps {
  track: CreativeTrack;
  internal: InternalStatusKey;
  client: ClientStatusKey;
  /** Hides the internal bar entirely; used on the client interface. */
  clientOnly?: boolean;
  onAdvanceInternal?: () => void;
  onAdvanceClient?: () => void;
}

/** The two note strings are copy, not labels: they are part of the specification. */
export const CLIENT_TRACK_LOCKED_NOTE = 'Opens when internal status reaches Approved.';
export const CLIENT_TRACK_LIVE_NOTE = 'Client track is live. The client sees only this bar.';

/** The dimming the handoff specifies for a client bar behind a closed gate. */
const DIMMED: CSSProperties = { opacity: 0.42, filter: 'saturate(.4)' };
const LIVE: CSSProperties = { opacity: 1, filter: 'saturate(1)' };
const TRANSITION = 'opacity 500ms ease, border-color 500ms ease, filter 500ms ease';

/**
 * The two-track approval widget (design handoff 2026-09-16).
 *
 * The gate is never recomputed here: `isClientTrackOpen` from `@tas/domain/state` decides whether the
 * client bar is live, and every status label and chip tone comes from the same module.
 */
export function TwoTrackApproval({
  track,
  internal,
  client,
  clientOnly = false,
  onAdvanceInternal,
  onAdvanceClient,
}: TwoTrackApprovalProps) {
  const internalSteps = internalStatusFor(track);
  const internalEntry = internalSteps.find((entry) => entry.key === internal);
  const clientEntry = CLIENT_STATUS.find((entry) => entry.key === client);

  // `clientOnly` renders the client bar always live, never dimmed.
  const open = clientOnly || isClientTrackOpen(internal);

  const clientWrapperStyle: CSSProperties = {
    ...(open ? LIVE : DIMMED),
    borderColor: open ? 'var(--accent-line)' : 'var(--line)',
    transition: TRANSITION,
  };

  return (
    <div data-slot="two-track-approval" data-track={track} className="flex flex-col gap-3">
      {clientOnly ? null : (
        <section
          data-slot="internal-track"
          className="rounded-card border border-line bg-surface p-4"
        >
          <header className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-[11px] font-medium tracking-wide text-text3 uppercase">
              Internal status
            </h3>
            {internalEntry === undefined ? null : (
              <StatusChip tone={chipTone(internalEntry.label)} label={internalEntry.label} />
            )}
          </header>
          <div data-slot="internal-steps">
            {internalSteps.map((entry, index) => (
              <StepRow
                key={entry.key}
                label={entry.label}
                tip={entry.description}
                state={stepState(internalSteps, internal, entry.key)}
                isLast={index === internalSteps.length - 1}
              />
            ))}
          </div>
          {onAdvanceInternal === undefined ? null : (
            <div className="mt-3 flex justify-end">
              <Button size="sm" variant="secondary" onClick={onAdvanceInternal}>
                Advance internal
              </Button>
            </div>
          )}
        </section>
      )}

      <section
        data-slot="client-track"
        data-open={String(open)}
        className={cn('rounded-card border bg-surface p-4')}
        style={clientWrapperStyle}
      >
        <header className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-[11px] font-medium tracking-wide text-text3 uppercase">
            Client status
          </h3>
          {open ? (
            clientEntry === undefined ? null : (
              <StatusChip tone={chipTone(clientEntry.label)} label={clientEntry.label} />
            )
          ) : (
            <StatusChip tone="mute" label="locked" />
          )}
        </header>
        <div data-slot="client-steps">
          {CLIENT_STATUS.map((entry, index) => (
            <StepRow
              key={entry.key}
              label={entry.label}
              tip={entry.description}
              state={stepState(CLIENT_STATUS, client, entry.key)}
              isLast={index === CLIENT_STATUS.length - 1}
            />
          ))}
        </div>
        <p data-slot="client-track-note" className="mt-3 text-[11px] leading-snug text-text3">
          {open ? CLIENT_TRACK_LIVE_NOTE : CLIENT_TRACK_LOCKED_NOTE}
        </p>
        {onAdvanceClient === undefined ? null : (
          <div className="mt-3 flex justify-end">
            <Button size="sm" variant="secondary" onClick={onAdvanceClient} disabled={!open}>
              Advance client
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
