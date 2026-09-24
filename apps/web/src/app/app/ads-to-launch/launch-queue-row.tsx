'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import {
  Button,
  DEMO_WRITE_HINT,
  DisabledWrite,
  disabledWriteClassName,
  StatusChip,
} from '@tas/ui';

import { Icon } from '@/components/shell/icons';

import {
  markAsLaunchedAction,
  markAsPausedAction,
  resumeLaunchedAction,
  type LaunchActionFailure,
  type LaunchActionResult,
} from './actions';
import type { LaunchQueueItem } from './fields';

/**
 * One creative on the launch queue. Everything it shows was resolved on the server by
 * `launchQueueItem`: the chip is the domain's label and tone through `StatusChip`, the controls are
 * only the moves `launchTransition` allows from this row's statuses, and the generated names render
 * in `font-mono` (CLAUDE.md UI governance). Each control is a real `<form>` submitting the brief id
 * alone — never a status — so it works before hydration and a tampered form cannot choose a target.
 * In demo mode the controls are inert and say why (`DisabledWrite`); the actions refuse there too.
 */
interface LaunchQueueRowProps {
  readonly item: LaunchQueueItem;
  readonly demo: boolean;
}

export function LaunchQueueRow({ item, demo }: LaunchQueueRowProps) {
  const [launchState, launch, launching] = useActionState<LaunchActionResult | null, FormData>(
    markAsLaunchedAction,
    null,
  );
  const [pauseState, pause, pausing] = useActionState<LaunchActionResult | null, FormData>(
    markAsPausedAction,
    null,
  );
  const [resumeState, resume, resuming] = useActionState<LaunchActionResult | null, FormData>(
    resumeLaunchedAction,
    null,
  );
  const dispatch = { launch, pause, resume } as const;
  const pending = launching || pausing || resuming;
  const failure = [launchState, pauseState, resumeState].find(
    (state): state is LaunchActionFailure => state !== null && !state.ok,
  );

  return (
    <li
      data-slot="launch-row"
      className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex min-w-0 items-center gap-2">
          {item.priorityLabel === null ? null : (
            <span className="shrink-0 rounded-input border border-line bg-surface2 px-1.5 py-0.5 font-mono text-[11px] text-text2">
              {item.priorityLabel}
            </span>
          )}
          <Link
            href={item.href}
            className="min-w-0 truncate font-mono text-sm text-text hover:text-accent"
          >
            {item.name}
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text3">
          <span className="flex items-center gap-1">
            <Icon name={item.track === 'video' ? 'ugc' : 'assets'} className="size-3.5 shrink-0" />
            {item.format}
          </span>
          <span className={item.conceptName === null ? undefined : 'font-mono'}>
            {item.conceptName ?? 'Standalone'}
          </span>
          {item.angleName === null ? null : <span>{item.angleName}</span>}
          {item.launchedAtLabel === null ? null : (
            <span className="font-mono">Launched {item.launchedAtLabel}</span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <StatusChip tone={item.statusTone} label={item.statusLabel} />
        {item.downloadUrl === null ? null : (
          <Button asChild size="sm" variant="outline">
            <a href={item.downloadUrl} target="_blank" rel="noopener noreferrer">
              Download
            </a>
          </Button>
        )}
        {item.controls.map((control) => (
          <form key={control.key} action={dispatch[control.key]} className="flex">
            <input type="hidden" name="id" value={item.id} />
            <DisabledWrite active={demo} hint={DEMO_WRITE_HINT}>
              <Button
                type="submit"
                size="sm"
                variant={control.key === 'launch' ? 'default' : 'outline'}
                disabled={demo || pending}
                title={demo ? DEMO_WRITE_HINT : control.description}
                data-action={control.key}
                className={demo ? disabledWriteClassName : undefined}
              >
                {control.label}
              </Button>
            </DisabledWrite>
          </form>
        ))}
      </div>

      {failure === undefined ? null : (
        <p role="alert" className="text-xs text-bad sm:basis-full">
          {failure.error}
        </p>
      )}
    </li>
  );
}
