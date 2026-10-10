'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { creativeSources, type CreativeSource } from '@tas/db/schema';
import { BRIEF_NAME_DEFAULT_SOURCE, generateBriefName } from '@tas/domain/briefs';
import {
  conceptNameSegment,
  CREATIVE_FUNNELS,
  CREATIVE_TYPES,
  type CreativeFunnelKey,
  type CreativeTypeKey,
} from '@tas/domain/creatives';
import {
  Button,
  DEMO_WRITE_HINT,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  disabledWriteClassName,
  DisabledWrite,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@tas/ui';

import { createBriefAction, type BriefActionResult } from '@/app/app/creative-design/actions';

/** The concept list the Standalone slug is slipped into, so a creative without a concept is a choice. */
const STANDALONE_VALUE = 'standalone';

/** A concept as the Concept select offers it: the generated `Batch-Angle-Theme` name and its batch. */
export interface ConceptOption {
  readonly id: string;
  readonly name: string;
  readonly batch: string | null;
}

/**
 * "New creative" on the Creative Sheet (2026-10-09, audit item 7). The one entry point for a new
 * creative: it creates the BRIEF through `createBriefAction` — auto-named by `generateBriefName`,
 * numbered under the brand's advisory lock — and the linked sheet row in the same transaction, so
 * a sheet row never exists without a named, numbered creative behind it.
 *
 * It is the Oct 5 `NewBriefDialog` re-homed from the retired Creative Design list, with two fixes
 * the audit found: Source is a select over `creativeSources` (and the action now stores it), and
 * the concept segment is `conceptNameSegment` — the concept's `Angle-Theme` without its batch, so
 * a linked creative reads `TAS-TOF-V001-Pain-UGC-B1` and never `…-B1-Pain-UGC-B1`.
 *
 * The preview is a client-side pure call to `generateBriefName`, so the name updates with no round
 * trip as the user picks source, funnel, type, concept and batch. `nextNumber` is the page's best
 * guess (`MAX(brief_number) + 1` over the briefs it loaded); the server allocates the real one.
 *
 * MANUAL-OVERRIDE TOGGLE. Auto mode (the default) renders the name field read-only and fills it from
 * the formula; the row is stored with `name_mode = 'auto'` and follows its concept's renames.
 * Flipping the Switch releases the field; the typed name is stored verbatim as `'manual'` and is
 * never rewritten by anything.
 */
interface NewCreativeDialogProps {
  readonly demo: boolean;
  /** Every concept of the brand, for the Concept select. Standalone (null concept) is the default. */
  readonly conceptOptions: readonly ConceptOption[];
  /** The number the preview shows; the server allocates the real one inside the transaction. */
  readonly nextNumber: number;
  /** Called with the created creative BEFORE the refresh, so the sheet can show it at once (SMOKE-14). */
  readonly onCreated?: (created: { readonly id: string; readonly name: string }) => void;
}

export function NewCreativeDialog({
  demo,
  conceptOptions,
  nextNumber,
  onCreated,
}: NewCreativeDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<BriefActionResult | null, FormData>(
    createBriefAction,
    null,
  );

  const [source, setSource] = useState<CreativeSource>(BRIEF_NAME_DEFAULT_SOURCE);
  const [funnel, setFunnel] = useState<CreativeFunnelKey>(CREATIVE_FUNNELS[0].key);
  const [type, setType] = useState<CreativeTypeKey>(CREATIVE_TYPES[0].key);
  const [conceptChoice, setConceptChoice] = useState(STANDALONE_VALUE);
  const [batch, setBatch] = useState('');
  const [nameMode, setNameMode] = useState<'auto' | 'manual'>('auto');
  const [manualName, setManualName] = useState('');

  useEffect(() => {
    if (state !== null && state.ok) {
      onCreated?.({ id: state.id, name: state.name });
      setOpen(false);
      setBatch('');
      setConceptChoice(STANDALONE_VALUE);
      setNameMode('auto');
      setManualName('');
      router.refresh();
    }
  }, [state, router, onCreated]);

  const concept = useMemo(
    () =>
      conceptChoice === STANDALONE_VALUE
        ? null
        : (conceptOptions.find((option) => option.id === conceptChoice) ?? null),
    [conceptChoice, conceptOptions],
  );

  // A linked creative copies its concept's batch, exactly as the action does.
  const effectiveBatch = concept?.batch ?? batch;
  const auto = generateBriefName({
    source,
    funnel,
    creativeType: type,
    number: nextNumber,
    concept: concept === null ? null : conceptNameSegment(concept),
    batch: effectiveBatch,
  });
  const preview = nameMode === 'manual' && manualName.trim() !== '' ? manualName : auto;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-slot="new-creative">
          New creative
        </Button>
      </DialogTrigger>
      <DialogContent data-slot="new-creative-dialog" className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New creative</DialogTitle>
          <DialogDescription>
            Source-Funnel-TypeInitial-Number-Concept-Batch. The name writes itself as you choose
            each part; flip the toggle to type one by hand. The creative lands on this sheet.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="version" value="1" />
          <input type="hidden" name="nameMode" value={nameMode} />
          {nameMode === 'manual' ? (
            <input type="hidden" name="nameOverride" value={manualName} />
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            {/*
              Every field is interactive in demo mode too: the live preview is the demo
              acceptance, and it cannot update if the inputs are locked. Only the submit is
              disabled, so a demo visitor sees the formula work without a write.
            */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-creative-source">Source</Label>
              <Select
                value={source}
                onValueChange={(value) => {
                  setSource(value as CreativeSource);
                }}
              >
                <SelectTrigger id="new-creative-source" data-slot="new-creative-source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {creativeSources.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="source" value={source} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-creative-funnel">Funnel</Label>
              <Select
                value={funnel}
                onValueChange={(value) => {
                  setFunnel(value as CreativeFunnelKey);
                }}
              >
                <SelectTrigger id="new-creative-funnel" data-slot="new-creative-funnel">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CREATIVE_FUNNELS.map((option) => (
                    <SelectItem key={option.key} value={option.key}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="funnel" value={funnel} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-creative-type">Type</Label>
              <Select
                value={type}
                onValueChange={(value) => {
                  setType(value as CreativeTypeKey);
                }}
              >
                <SelectTrigger id="new-creative-type" data-slot="new-creative-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CREATIVE_TYPES.map((option) => (
                    <SelectItem key={option.key} value={option.key}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="type" value={type} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-creative-concept">Concept</Label>
              <Select value={conceptChoice} onValueChange={setConceptChoice}>
                <SelectTrigger id="new-creative-concept" data-slot="new-creative-concept">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={STANDALONE_VALUE}>Standalone</SelectItem>
                  {conceptOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      <span className="font-mono text-xs">{option.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input
                type="hidden"
                name="conceptId"
                value={conceptChoice === STANDALONE_VALUE ? '' : conceptChoice}
              />
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="new-creative-batch">Batch</Label>
              <Input
                id="new-creative-batch"
                name="batch"
                value={effectiveBatch}
                onChange={(event) => {
                  setBatch(event.target.value);
                }}
                readOnly={concept !== null}
                placeholder="Batch 1"
                data-slot="new-creative-batch"
              />
              {concept !== null ? (
                <p className="text-[11px] text-text3">Copied from the concept.</p>
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-card border border-line bg-surface2 px-3 py-2">
            <Label htmlFor="new-creative-name-mode" className="flex flex-col text-xs text-text2">
              <span>Type the name by hand</span>
              <span className="text-[11px] text-text3">
                Off: the formula writes it and keeps it in step with the concept. On: edit the field
                below; the name is then yours and is never rewritten.
              </span>
            </Label>
            <Switch
              id="new-creative-name-mode"
              checked={nameMode === 'manual'}
              onCheckedChange={(checked) => {
                setNameMode(checked ? 'manual' : 'auto');
              }}
              data-slot="new-creative-name-mode"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-creative-name">Name</Label>
            <Input
              id="new-creative-name"
              value={nameMode === 'manual' ? manualName : auto}
              onChange={(event) => {
                if (nameMode === 'manual') setManualName(event.target.value);
              }}
              readOnly={nameMode === 'auto'}
              data-slot="new-creative-name"
              className="font-mono"
            />
            <p className="font-mono text-xs text-text3" data-slot="new-creative-preview">
              {preview}
            </p>
          </div>

          {state !== null && !state.ok ? (
            <p className="text-xs text-bad" data-slot="new-creative-error">
              {state.error}
            </p>
          ) : null}

          <DialogFooter>
            <DisabledWrite active={demo} hint={DEMO_WRITE_HINT}>
              <Button
                type="submit"
                size="sm"
                disabled={demo || pending}
                data-slot="new-creative-submit"
                className={disabledWriteClassName}
              >
                {pending ? 'Saving…' : 'Create creative'}
              </Button>
            </DisabledWrite>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
