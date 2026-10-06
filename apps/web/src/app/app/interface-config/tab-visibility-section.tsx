'use client';

import { useActionState, useTransition } from 'react';
import { Button, DisabledWrite, Switch, disabledWriteClassName } from '@tas/ui';
import {
  CLIENT_TAB_KEYS,
  clientTabLabel,
  mergeTabVisibility,
  type ClientTabKey,
  type InterfaceTabVisibilityView,
} from '@tas/domain';

import {
  reorderTabAction,
  resetTabVisibilityAction,
  toggleTabVisibilityAction,
  type VisibilityActionResult,
} from './visibility-actions';

/**
 * Standard-tab visibility (Oct 6/7 Agent 4). The four shipped client tabs are listed in sort
 * order; each row offers a visibility toggle, two reorder arrows and a reset-to-default button
 * for a brand that has overridden the template.
 *
 * NO BUSINESS LOGIC HERE. The merge rule is `mergeTabVisibility` in `@tas/domain`; the server
 * actions decide what writes succeed. This component owns one decision: whether to show the reset
 * button on a row (shown only when the brand has its own row, i.e. the row's `brandId` matches
 * the current brand rather than inheriting the template default).
 */
interface TabVisibilitySectionProps {
  readonly brandId: string | null;
  readonly templateRows: readonly InterfaceTabVisibilityView[];
  readonly brandRows: readonly InterfaceTabVisibilityView[];
  readonly demo: boolean;
  readonly disabled: boolean;
}

export function TabVisibilitySection({
  brandId,
  templateRows,
  brandRows,
  demo,
  disabled,
}: TabVisibilitySectionProps) {
  const merged = mergeTabVisibility(templateRows, brandRows);
  const brandOverrideKeys = new Set(brandRows.map((row) => row.tabKey));
  return (
    <section
      data-slot="tab-visibility"
      aria-labelledby="tab-visibility-heading"
      className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4"
    >
      <div className="flex flex-col gap-1">
        <h2 id="tab-visibility-heading" className="text-sm font-medium text-text2">
          Standard tabs
        </h2>
        <p className="text-[12px] leading-snug text-text3">
          Toggle, reorder, or reset the four shipped client tabs. A brand that has not overridden a
          tab reads the template default; a reset deletes the brand&rsquo;s row and the template
          default applies again.
        </p>
      </div>
      <ul className="flex flex-col gap-1" data-slot="tab-visibility-list">
        {merged.map((row, index) => (
          <TabVisibilityRow
            key={row.tabKey}
            tabKey={row.tabKey}
            isVisible={row.isVisible}
            overridden={brandId !== null && brandOverrideKeys.has(row.tabKey)}
            canMoveUp={index > 0}
            canMoveDown={index < CLIENT_TAB_KEYS.length - 1}
            demo={demo}
            disabled={disabled}
          />
        ))}
      </ul>
    </section>
  );
}

interface TabVisibilityRowProps {
  readonly tabKey: ClientTabKey;
  readonly isVisible: boolean;
  readonly overridden: boolean;
  readonly canMoveUp: boolean;
  readonly canMoveDown: boolean;
  readonly demo: boolean;
  readonly disabled: boolean;
}

function TabVisibilityRow({
  tabKey,
  isVisible,
  overridden,
  canMoveUp,
  canMoveDown,
  demo,
  disabled,
}: TabVisibilityRowProps) {
  const [toggleState, toggleAction, togglePending] = useActionState<
    VisibilityActionResult | null,
    FormData
  >(toggleTabVisibilityAction, null);
  const [, reorderAction, reorderPending] = useActionState<VisibilityActionResult | null, FormData>(
    reorderTabAction,
    null,
  );
  const [, resetAction, resetPending] = useActionState<VisibilityActionResult | null, FormData>(
    resetTabVisibilityAction,
    null,
  );
  const [, startTransition] = useTransition();
  const anyPending = togglePending || reorderPending || resetPending;

  const submit = (action: (fd: FormData) => void, fd: FormData) => {
    startTransition(() => {
      action(fd);
    });
  };

  return (
    <li
      className="flex items-center justify-between gap-3 rounded-input border border-line bg-surface2 px-3 py-2"
      data-slot="tab-row"
      data-tab-key={tabKey}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <DisabledWrite active={demo || disabled}>
          <Switch
            data-slot="tab-visibility-switch"
            data-tab-key={tabKey}
            checked={isVisible}
            disabled={demo || disabled || anyPending}
            onCheckedChange={(checked) => {
              const fd = new FormData();
              fd.append('tabKey', tabKey);
              fd.append('isVisible', String(checked));
              submit(toggleAction, fd);
            }}
            className={disabledWriteClassName}
          />
        </DisabledWrite>
        <span className="text-sm text-text">{clientTabLabel(tabKey)}</span>
        {overridden ? (
          <span className="font-mono text-[10px] tracking-wide text-text3 uppercase">
            customised
          </span>
        ) : (
          <span className="font-mono text-[10px] tracking-wide text-text4 uppercase">
            inherited
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        {(['up', 'down'] as const).map((direction) => {
          const movable = direction === 'up' ? canMoveUp : canMoveDown;
          return (
            <DisabledWrite key={direction} active={demo || disabled}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                data-slot="tab-reorder"
                data-direction={direction}
                data-tab-key={tabKey}
                disabled={!movable || demo || disabled || anyPending}
                onClick={() => {
                  const fd = new FormData();
                  fd.append('tabKey', tabKey);
                  fd.append('direction', direction);
                  submit(reorderAction, fd);
                }}
                className={disabledWriteClassName}
                aria-label={`Move ${clientTabLabel(tabKey)} ${direction}`}
              >
                {direction === 'up' ? '↑' : '↓'}
              </Button>
            </DisabledWrite>
          );
        })}
        {overridden ? (
          <DisabledWrite active={demo || disabled}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-slot="tab-reset"
              data-tab-key={tabKey}
              disabled={demo || disabled || anyPending}
              onClick={() => {
                const fd = new FormData();
                fd.append('tabKey', tabKey);
                submit(resetAction, fd);
              }}
              className={disabledWriteClassName}
            >
              Reset
            </Button>
          </DisabledWrite>
        ) : null}
      </div>
      {toggleState !== null && !toggleState.ok ? (
        <p
          data-slot="tab-error"
          data-tab-key={tabKey}
          className="basis-full text-xs text-bad"
          role="alert"
        >
          {toggleState.error}
        </p>
      ) : null}
    </li>
  );
}
