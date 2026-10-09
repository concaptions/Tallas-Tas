'use client';

import Link from 'next/link';
import type { PipelineSummary } from '@tas/domain';
import {
  chipTone,
  clientApprovalLabel,
  clientApprovalTone,
  copyStatusLabel,
  copyStatusTone,
  creatorStatusLabel,
  creatorStatusTone,
  CLIENT_STATUS,
  INTERNAL_VIDEO_STATUS,
  INTERNAL_STATIC_STATUS,
  type ChipTone,
} from '@tas/domain/state';
import { StatusChip } from '@tas/ui';

import { conceptsPath, copywritingPath, creativeSheetPath, ugcPath } from '@/lib/routes';

/**
 * A lookup for all internal status keys → { label, tone }. Merges video and static tracks so every
 * internal key resolves in one map. The map is built once at module load and used purely for display.
 */
const INTERNAL_STATUS_MAP = new Map<string, { label: string; tone: ChipTone }>();
for (const entry of [...INTERNAL_VIDEO_STATUS, ...INTERNAL_STATIC_STATUS]) {
  if (!INTERNAL_STATUS_MAP.has(entry.key)) {
    INTERNAL_STATUS_MAP.set(entry.key, { label: entry.label, tone: chipTone(entry.label) });
  }
}

const CLIENT_STATUS_MAP = new Map<string, { label: string; tone: ChipTone }>();
for (const entry of CLIENT_STATUS) {
  CLIENT_STATUS_MAP.set(entry.key, { label: entry.label, tone: chipTone(entry.label) });
}

function internalChip(key: string): { label: string; tone: ChipTone } {
  return INTERNAL_STATUS_MAP.get(key) ?? { label: key, tone: 'mute' };
}

function clientChip(key: string): { label: string; tone: ChipTone } {
  return CLIENT_STATUS_MAP.get(key) ?? { label: key, tone: 'mute' };
}

function copyChip(key: string): { label: string; tone: ChipTone } {
  return { label: copyStatusLabel(key), tone: copyStatusTone(key) };
}

function creativeSheetChip(key: string): { label: string; tone: ChipTone } {
  return { label: clientApprovalLabel(key), tone: clientApprovalTone(key) as ChipTone };
}

function creatorClientChip(key: string): { label: string; tone: ChipTone } {
  return { label: creatorStatusLabel(key), tone: creatorStatusTone(key) };
}

interface StatusBreakdownProps {
  readonly breakdown: Record<string, number>;
  readonly resolver: (key: string) => { label: string; tone: ChipTone };
}

function StatusBreakdown({ breakdown, resolver }: StatusBreakdownProps) {
  const entries = Object.entries(breakdown).filter(([, count]) => count > 0);
  if (entries.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {entries.map(([key, count]) => {
        const { label, tone } = resolver(key);
        return (
          <StatusChip
            key={key}
            tone={tone}
            label={`${label} (${String(count)})`}
            className="text-[9px]"
          />
        );
      })}
    </div>
  );
}

interface SummaryCardProps {
  readonly title: string;
  readonly total: number;
  readonly href: string;
  readonly breakdown: Record<string, number>;
  readonly resolver: (key: string) => { label: string; tone: ChipTone };
}

function SummaryCard({ title, total, href, breakdown, resolver }: SummaryCardProps) {
  return (
    <Link href={href} className="block rounded-card">
      <div className="flex h-full cursor-pointer flex-col rounded-card border border-line bg-surface p-4 transition-colors hover:border-accent-line">
        <p className="text-sm font-semibold text-text">{title}</p>
        <p className="mt-1 font-mono text-2xl text-text">{total}</p>
        <StatusBreakdown breakdown={breakdown} resolver={resolver} />
      </div>
    </Link>
  );
}

interface OverviewDashboardProps {
  readonly summary: PipelineSummary;
}

export function OverviewDashboard({ summary }: OverviewDashboardProps) {
  return (
    <section
      aria-labelledby="pipeline-heading"
      data-slot="overview-dashboard"
      className="flex flex-col gap-3"
    >
      <h2 id="pipeline-heading" className="text-sm font-medium text-text2">
        Pipeline
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <SummaryCard
          title="Concepts"
          total={summary.concepts.total}
          href={conceptsPath}
          breakdown={summary.concepts.byClientStatus}
          resolver={clientChip}
        />
        <SummaryCard
          title="Briefs"
          total={summary.briefs.total}
          href={creativeSheetPath}
          breakdown={summary.briefs.byInternalStatus}
          resolver={internalChip}
        />
        <SummaryCard
          title="Creative Sheet"
          total={summary.creativeSheet.total}
          href={creativeSheetPath}
          breakdown={summary.creativeSheet.byStatus}
          resolver={creativeSheetChip}
        />
        <SummaryCard
          title="Copywriting"
          total={summary.copywriting.total}
          href={copywritingPath}
          breakdown={summary.copywriting.byStatus}
          resolver={copyChip}
        />
        <SummaryCard
          title="Creators"
          total={summary.creators.total}
          href={ugcPath}
          breakdown={summary.creators.byClientStatus}
          resolver={creatorClientChip}
        />
      </div>
    </section>
  );
}
