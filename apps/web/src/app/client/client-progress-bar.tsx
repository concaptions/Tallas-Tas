import type { ClientProgress } from '@tas/domain/client-progress';

interface Props {
  readonly progress: ClientProgress;
}

export function ClientProgressBar({ progress }: Props) {
  if (progress.total === 0) return null;

  return (
    <div className="flex flex-col gap-2" data-slot="client-progress">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs font-medium text-text2">Approval progress</p>
        <p className="font-mono text-xs text-text3">
          {progress.approved}/{progress.total}
        </p>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-surface2">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${String(progress.percentage)}%` }}
        />
      </div>
      <p className="text-[11px] text-text4">{progress.percentage}% approved</p>
    </div>
  );
}
