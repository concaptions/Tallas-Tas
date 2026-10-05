'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BRIEF_NAME_DEFAULT_SOURCE, generateBriefName } from '@tas/domain/briefs';
import {
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

import { createBriefAction, type BriefActionResult } from './actions';

/** The concept list the Standalone slug is slipped into, so a brief without a concept is a choice. */
const STANDALONE_VALUE = 'standalone';

/**
 * The create form for a brief (Oct 5 sprint, Agent 3). A `Dialog` the "New brief" button opens.
 * Everything else on the page is read-only in demo mode and the paste's own instructions pin the
 * PREVIEW behaviour here as the demo-mode acceptance — the write-side e2e is deferred to the live
 * shelf. The preview is a client-side pure call to `generateBriefName`, so the name updates with no
 * round trip as the user picks source, funnel, type, concept and batch.
 *
 * MANUAL-OVERRIDE TOGGLE. Auto mode (the default) renders the name field read-only and fills it from
 * `generateBriefName`. Flipping the Switch to manual releases the field and the user types the name
 * — the server stores whatever is submitted when `nameMode === 'manual'` and a non-empty override
 * is present. In auto mode the override is omitted, which is the server's "use the formula" branch.
 */
interface NewBriefDialogProps {
  readonly demo: boolean;
  /** Every concept of the brand, for the Concept select. Standalone (null concept) is the default. */
  readonly conceptOptions: readonly { readonly id: string; readonly name: string }[];
}

export function NewBriefDialog({ demo, conceptOptions }: NewBriefDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<BriefActionResult | null, FormData>(
    createBriefAction,
    null,
  );

  const [source, setSource] = useState(BRIEF_NAME_DEFAULT_SOURCE);
  const [funnel, setFunnel] = useState<CreativeFunnelKey>(CREATIVE_FUNNELS[0].key);
  const [type, setType] = useState<CreativeTypeKey>(CREATIVE_TYPES[0].key);
  const [conceptChoice, setConceptChoice] = useState(STANDALONE_VALUE);
  const [batch, setBatch] = useState('');
  const [nameMode, setNameMode] = useState<'auto' | 'manual'>('auto');
  const [manualName, setManualName] = useState('');

  useEffect(() => {
    if (state !== null && state.ok) {
      setOpen(false);
      setBatch('');
      setConceptChoice(STANDALONE_VALUE);
      setNameMode('auto');
      setManualName('');
      router.refresh();
    }
  }, [state, router]);

  const conceptName = useMemo(
    () =>
      conceptChoice === STANDALONE_VALUE
        ? null
        : (conceptOptions.find((option) => option.id === conceptChoice)?.name ?? null),
    [conceptChoice, conceptOptions],
  );

  // Preview number: the server allocates the real `briefNumber` inside the transaction, so this is
  // the honest placeholder — 1 reads as "V001" for the first-brief case, and the e2e pins that.
  const previewNumber = 1;
  const auto = generateBriefName({
    source,
    funnel,
    creativeType: type,
    number: previewNumber,
    concept: conceptName,
    batch,
  });
  const preview = nameMode === 'manual' && manualName.trim() !== '' ? manualName : auto;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-slot="new-brief">
          New brief
        </Button>
      </DialogTrigger>
      <DialogContent data-slot="new-brief-dialog" className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>New brief</DialogTitle>
          <DialogDescription>
            Source-Funnel-TypeInitial-Number-Concept-Batch. The name writes itself as you choose
            each part; flip the toggle to type one by hand.
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
              Every field below is INTERACTIVE in demo mode too — the paste's demo acceptance is
              the live preview, which cannot update if the inputs are locked. Only the submit at
              the bottom is disabled, so a demo visitor sees the formula work without a write.
            */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-brief-source">Source</Label>
              <Input
                id="new-brief-source"
                name="source"
                value={source}
                onChange={(event) => {
                  setSource(event.target.value);
                }}
                data-slot="new-brief-source"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-brief-funnel">Funnel</Label>
              <Select
                value={funnel}
                onValueChange={(value) => {
                  setFunnel(value as CreativeFunnelKey);
                }}
              >
                <SelectTrigger id="new-brief-funnel" data-slot="new-brief-funnel">
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
              <Label htmlFor="new-brief-type">Type</Label>
              <Select
                value={type}
                onValueChange={(value) => {
                  setType(value as CreativeTypeKey);
                }}
              >
                <SelectTrigger id="new-brief-type" data-slot="new-brief-type">
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
              <Label htmlFor="new-brief-concept">Concept</Label>
              <Select value={conceptChoice} onValueChange={setConceptChoice}>
                <SelectTrigger id="new-brief-concept" data-slot="new-brief-concept">
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
              <Label htmlFor="new-brief-batch">Batch</Label>
              <Input
                id="new-brief-batch"
                name="batch"
                value={batch}
                onChange={(event) => {
                  setBatch(event.target.value);
                }}
                placeholder="Batch 1"
                data-slot="new-brief-batch"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-card border border-line bg-surface2 px-3 py-2">
            <Label htmlFor="new-brief-name-mode" className="flex flex-col text-xs text-text2">
              <span>Type the name by hand</span>
              <span className="text-[11px] text-text3">
                Off: the formula writes it. On: edit the field below.
              </span>
            </Label>
            <Switch
              id="new-brief-name-mode"
              checked={nameMode === 'manual'}
              onCheckedChange={(checked) => {
                setNameMode(checked ? 'manual' : 'auto');
              }}
              data-slot="new-brief-name-mode"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-brief-name">Name</Label>
            <Input
              id="new-brief-name"
              value={nameMode === 'manual' ? manualName : auto}
              onChange={(event) => {
                if (nameMode === 'manual') setManualName(event.target.value);
              }}
              readOnly={nameMode === 'auto'}
              data-slot="new-brief-name"
              className="font-mono"
            />
            <p className="text-xs text-text3" data-slot="new-brief-preview">
              {preview}
            </p>
          </div>

          {state !== null && !state.ok ? (
            <p className="text-xs text-bad" data-slot="new-brief-error">
              {state.error}
            </p>
          ) : null}

          <DialogFooter>
            <DisabledWrite active={demo} hint={DEMO_WRITE_HINT}>
              <Button
                type="submit"
                size="sm"
                disabled={demo || pending}
                data-slot="new-brief-submit"
                className={disabledWriteClassName}
              >
                {pending ? 'Saving…' : 'Create brief'}
              </Button>
            </DisabledWrite>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
