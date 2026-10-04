'use client';

import { BriefPipelineSummary } from '@/app/app/creative-design/brief-pipeline';
import { buildBriefPipeline } from '@/app/app/creative-design/pipeline';

/**
 * The Creative Design pipeline summary (AI-48), mounted as the product mounts it (CLAUDE.md UI
 * governance rule 4): the route's own component, fed by the route's own pure function, so nothing is
 * re-drawn here and a tone cannot drift from `EDITOR_STAGES`.
 *
 * The two stories are the two states worth looking at — a working board, and the empty page a search
 * can narrow to, which must still show four zeroed buckets rather than collapse.
 */
const BOARD: readonly { readonly internalStatus: string }[] = [
  { internalStatus: 'sent_to_video_editor' },
  { internalStatus: 'sent_to_designer' },
  { internalStatus: 'sent_to_designer' },
  { internalStatus: 'video_editing_in_progress' },
  { internalStatus: 'images_revisions' },
  { internalStatus: 'ad_submitted' },
  { internalStatus: 'approved' },
  { internalStatus: 'launched' },
];

export function BriefPipelineStory() {
  return <BriefPipelineSummary pipeline={buildBriefPipeline(BOARD)} />;
}

export function BriefPipelineEmptyStory() {
  return <BriefPipelineSummary pipeline={buildBriefPipeline([])} />;
}
