import { Lock, LockOpen } from '@tas/ui/icons';

import { qaGateTone, type FocusQaGateTone } from './focus-mode';

/**
 * The QA gate box under Focus Mode's checklist (B4.V1 / B1.V29 / B4.V2). Warn-toned with a shut
 * padlock while a required tick is missing, ok-toned with the open padlock once the gate opens —
 * the box is the one place the checklist says whether Approve and Submit to Client are unlocked,
 * so it must change when they do. `data-open` lets a spec read the state without parsing the copy.
 */
export interface QaGateBoxProps {
  /** `1 of 2 required checks complete.` */
  readonly progress: string;
  /** Every required tick is set. */
  readonly open: boolean;
  /** The second line: what the gate unlocks, or that it has. */
  readonly note: string;
}

const TONE_CLASS: Readonly<Record<FocusQaGateTone, string>> = {
  ok: 'border-ok/40 bg-ok/10 text-ok',
  warn: 'border-warn/35 bg-warn/10 text-warn',
};

export function QaGateBox({ progress, open, note }: QaGateBoxProps) {
  const Padlock = open ? LockOpen : Lock;
  return (
    <div
      data-slot="focus-qa-gate"
      data-open={open ? 'true' : 'false'}
      className={`mt-3 flex items-start gap-2 rounded-card border px-3 py-2.5 text-[11px] leading-relaxed ${TONE_CLASS[qaGateTone(open)]}`}
    >
      <Padlock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
      <div className="min-w-0">
        <p>{progress}</p>
        <p className="text-text3">{note}</p>
      </div>
    </div>
  );
}
