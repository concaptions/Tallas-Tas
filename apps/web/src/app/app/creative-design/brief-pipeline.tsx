import { StatusChip } from '@tas/ui';

import type { BriefPipeline } from './pipeline';

/**
 * The pipeline summary above the Creative Design view switcher (AI-48): four counts, one per editor
 * stage plus the briefs that have left the board.
 *
 * Pure presentation. Every count, label and tone is computed by `buildBriefPipeline` from the briefs
 * already on the page, so this component chooses nothing — not a word and not a colour. The count
 * is the system's own output, so it renders in `font-mono` like every other generated number, and
 * the stage's tone rides a `StatusChip`, never a locally coloured pill.
 */
export function BriefPipelineSummary({ pipeline }: { readonly pipeline: BriefPipeline }) {
  return (
    <section
      data-slot="brief-pipeline"
      aria-label="Pipeline"
      className="grid grid-cols-2 gap-3 md:grid-cols-4"
    >
      {pipeline.stages.map((stage) => (
        <div
          key={stage.key}
          data-slot="brief-pipeline-stage"
          data-stage={stage.key}
          className="flex flex-col gap-1.5 rounded-card border border-line bg-surface2 px-4 py-3"
        >
          <StatusChip tone={stage.tone} label={stage.label} className="self-start" />
          <span className="font-mono text-2xl text-text" data-slot="brief-pipeline-count">
            {String(stage.count)}
          </span>
        </div>
      ))}
    </section>
  );
}
