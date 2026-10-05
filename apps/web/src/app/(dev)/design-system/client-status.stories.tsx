'use client';

import { ClientStatusBadge } from '@tas/ui';
import {
  CLIENT_STATUS,
  COPY_STATUS,
  CREATOR_STATUS,
  chipTone,
  copyStatusTone,
  creatorStatusTone,
} from '@tas/domain/state';

import { ClientStatusDropdown } from '@/components/status/client-status-dropdown';

/**
 * The design-system entries for the shared client-status badge and dropdown (Oct 5 Talal sync,
 * Agent 5). The vocabulary comes from `@tas/domain/state`; the tones come from each table's own
 * tone helper — exactly the pattern CopyStatusChips and the two-track approval already follow.
 */
export function ClientStatusBadgesStory() {
  return (
    <div className="flex flex-col gap-5 rounded-card border border-line bg-surface p-5">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[11px] tracking-wide text-text3 uppercase">
          CLIENT_STATUS — concepts and creative briefs
        </span>
        <div className="flex flex-wrap items-center gap-3">
          {CLIENT_STATUS.map((entry) => (
            <ClientStatusBadge
              key={entry.key}
              vocabulary={CLIENT_STATUS}
              value={entry.key}
              toneFor={(value) => chipTone(CLIENT_STATUS.find((e) => e.key === value)?.label ?? '')}
            />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2 border-t border-line pt-4">
        <span className="font-mono text-[11px] tracking-wide text-text3 uppercase">
          CREATOR_STATUS — UGC Management
        </span>
        <div className="flex flex-wrap items-center gap-3">
          {CREATOR_STATUS.map((entry) => (
            <ClientStatusBadge
              key={entry.key}
              vocabulary={CREATOR_STATUS}
              value={entry.key}
              toneFor={creatorStatusTone}
            />
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2 border-t border-line pt-4">
        <span className="font-mono text-[11px] tracking-wide text-text3 uppercase">
          COPY_STATUS — Copywriting
        </span>
        <div className="flex flex-wrap items-center gap-3">
          {COPY_STATUS.map((entry) => (
            <ClientStatusBadge
              key={entry.key}
              vocabulary={COPY_STATUS}
              value={entry.key}
              toneFor={copyStatusTone}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ClientStatusDropdownDemoStory() {
  return (
    <div className="flex flex-col gap-5 rounded-card border border-line bg-surface p-5">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[11px] tracking-wide text-text3 uppercase">
          dropdown — concepts (demo mode, Save is disabled)
        </span>
        <ClientStatusDropdown
          tableKey="concepts"
          recordId="demo"
          currentStatus="pending_for_approval"
          disabled
        />
      </div>
      <div className="flex flex-col gap-2 border-t border-line pt-4">
        <span className="font-mono text-[11px] tracking-wide text-text3 uppercase">
          dropdown — creators (demo mode)
        </span>
        <ClientStatusDropdown
          tableKey="creators"
          recordId="demo"
          currentStatus="pending_for_approval"
          disabled
        />
      </div>
      <div className="flex flex-col gap-2 border-t border-line pt-4">
        <span className="font-mono text-[11px] tracking-wide text-text3 uppercase">
          dropdown — copywriting (demo mode)
        </span>
        <ClientStatusDropdown
          tableKey="copywriting"
          recordId="demo"
          currentStatus="pending_for_client_review"
          disabled
        />
      </div>
    </div>
  );
}
