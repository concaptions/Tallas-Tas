'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { GroupOrderEntry } from '@tas/domain';
import { cn } from '@tas/ui';

import {
  GroupSortableContext,
  SortableGroupHeader,
  useGroupOrder,
  type GroupOrderIO,
} from '@/components/views/group-order-controller';

/**
 * Design-system story for the Phase B5 group-reorder header (CLAUDE.md UI governance rule 4). The
 * controller is driven by local-state IO — no server actions, no network — so the page shows the
 * drag, pin and reset flow exactly as the data grid will render them. Three headers, a status-ish
 * default order, a right-click menu per header.
 */

const SEED_GROUPS: readonly string[] = ['draft', 'under_editing_or_designing', 'approved'];
const LABEL: Record<string, string> = {
  draft: 'Draft',
  under_editing_or_designing: 'Under editing or designing',
  approved: 'Approved',
};

type MutableHolder = { current: GroupOrderEntry[] | null };

function makeLocalIO(ref: MutableHolder): GroupOrderIO {
  return {
    load: () => Promise.resolve(ref.current),
    save: (order) => {
      ref.current = [...order];
      return Promise.resolve({ ok: true });
    },
    clear: () => {
      ref.current = null;
      return Promise.resolve({ ok: true });
    },
  };
}

export function GroupReorderStory() {
  const storage = useRef<GroupOrderEntry[] | null>(null);
  const io = useMemo(() => makeLocalIO(storage), []);
  const [notice, setNotice] = useState<string | null>(null);
  const onError = useCallback((message: string) => {
    setNotice(message);
  }, []);

  const controller = useGroupOrder({
    fieldKey: 'internal_status',
    naturalOrder: SEED_GROUPS,
    io,
    onError,
  });

  return (
    <section className="space-y-3" data-slot="group-reorder-story">
      <header className="space-y-1">
        <h3 className="text-sm font-semibold text-text">
          Drag, pin, reset — grouped view header row
        </h3>
        <p className="text-xs text-text3">
          Drag a header by its handle to reorder. Right-click (or long-press) a header for pin,
          unpin, reset, and the view-scope toggle. Changes persist to local state here; in the real
          grid they persist per-user through `saveGroupOrderAction`.
        </p>
      </header>

      <div className="rounded-card border border-line bg-surface2 p-3">
        <GroupSortableContext
          orderedValues={controller.orderedValues}
          onReorder={controller.reorder}
        >
          <div className="flex flex-col gap-1" data-slot="group-reorder-list">
            {controller.orderedValues.map((value) => {
              const pinned =
                controller.saved?.some((row) => row.value === value && row.pinned) ?? false;
              return (
                <div
                  key={value}
                  className={cn('rounded-input bg-surface3')}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    controller.openContextMenu(value, { x: event.clientX, y: event.clientY });
                  }}
                  data-slot="group-reorder-row"
                  data-group={value}
                >
                  <SortableGroupHeader
                    value={value}
                    label={LABEL[value] ?? value}
                    count={0}
                    pinned={pinned}
                  />
                </div>
              );
            })}
          </div>
        </GroupSortableContext>
        {controller.menu}
      </div>

      <p className="text-xs text-text3" data-slot="group-reorder-scope-label">
        Scope: {controller.isApplyToAllViews ? 'all views' : 'this view'}
        {' · '}
        <button
          type="button"
          className="underline"
          onClick={() => {
            controller.setApplyToAllViews(!controller.isApplyToAllViews);
          }}
          data-slot="group-reorder-scope-toggle"
        >
          toggle
        </button>
      </p>
      {notice ? (
        <p className="text-xs text-bad" data-slot="group-reorder-error">
          {notice}
        </p>
      ) : null}
    </section>
  );
}
