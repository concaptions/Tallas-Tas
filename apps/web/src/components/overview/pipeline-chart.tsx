import type { PipelineStep } from '@/lib/dashboard-source';

/**
 * The pipeline bar chart (TASK 6): briefs per internal status, in ladder order. Bars are plain
 * divs sized in percent — recharts is not installed (docs/decisions.md keeps the dependency list
 * short) and a horizontal bar list needs nothing a div cannot do. Colours are semantic tokens.
 */
export function PipelineChart({ steps }: { readonly steps: readonly PipelineStep[] }) {
  const max = Math.max(1, ...steps.map((step) => step.count));
  return (
    <section className="flex flex-col gap-3" data-slot="overview-pipeline">
      <h2 className="text-sm font-medium text-text2">Briefs by stage</h2>
      <ol className="flex flex-col gap-1.5 rounded-card border border-line bg-surface2 px-4 py-3">
        {steps.map((step) => (
          <li
            key={step.key}
            className="grid grid-cols-[minmax(0,180px)_1fr_2ch] items-center gap-3"
            data-slot="overview-pipeline-step"
            data-status={step.key}
          >
            <span className="truncate text-xs text-text3" title={step.label}>
              {step.label}
            </span>
            <span className="h-2 overflow-hidden rounded-input bg-surface3">
              <span
                className="block h-full rounded-input bg-accent"
                style={{ width: `${String(Math.round((step.count / max) * 100))}%` }}
              />
            </span>
            <span className="text-right font-mono text-xs text-text2">{step.count}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
