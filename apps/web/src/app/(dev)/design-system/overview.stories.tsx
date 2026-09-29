import { MetricCards } from '@/components/overview/metric-cards';
import { PipelineChart } from '@/components/overview/pipeline-chart';
import { demoBriefs } from '@tas/db';

import { buildPipeline, overviewMetrics } from '@/lib/dashboard-source';

/**
 * The Overview's pipeline section (TASK 6, UI governance rule 4): the eight role-scoped metric
 * cards and the briefs-by-stage bar chart, over the demo fixtures. The Admin set is the whole
 * pipeline; the Video Editor set shows the role scoping — three cards, nothing client-facing.
 */
export function OverviewMetricsAdminStory() {
  return <MetricCards cards={overviewMetrics('admin')} />;
}

export function OverviewMetricsEditorStory() {
  return <MetricCards cards={overviewMetrics('video_editor')} />;
}

export function OverviewPipelineStory() {
  return <PipelineChart steps={buildPipeline(demoBriefs)} />;
}
