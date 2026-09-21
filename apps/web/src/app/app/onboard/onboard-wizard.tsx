'use client';

import { useActionState, useState } from 'react';
import { Button, Input, Label } from '@tas/ui';
import { slugify } from '@tas/domain';

import { createBrandAction, type OnboardResult } from './actions';

const INITIAL_STATE: OnboardResult = { ok: true };

export function OnboardWizard() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [website, setWebsite] = useState('');

  const [state, formAction, isPending] = useActionState(
    async (_prev: OnboardResult, formData: FormData) => {
      return createBrandAction(formData);
    },
    INITIAL_STATE,
  );

  const errors = state.errors ?? [];
  const fieldError = (field: string) => errors.find((e) => e.field === field)?.message;

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) {
      setSlug(slugify(value));
    }
  }

  const canProceed = name.trim().length > 0 && slug.trim().length > 0;

  return (
    <div className="rounded-card border border-line bg-surface p-6">
      {step === 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-text1">Brand details</h2>

          <div className="space-y-1.5">
            <Label htmlFor="brand-name">Brand name</Label>
            <Input
              id="brand-name"
              value={name}
              onChange={(e) => {
                handleNameChange(e.target.value);
              }}
              placeholder="e.g. Niagara Sleep Solutions"
            />
            {fieldError('name') && <p className="text-sm text-fail">{fieldError('name')}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="brand-slug">URL slug</Label>
            <Input
              id="brand-slug"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              placeholder="e.g. niagara-sleep-solutions"
              className="font-mono"
            />
            {fieldError('slug') && <p className="text-sm text-fail">{fieldError('slug')}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="brand-website">Website (optional)</Label>
            <Input
              id="brand-website"
              value={website}
              onChange={(e) => {
                setWebsite(e.target.value);
              }}
              placeholder="https://example.com"
            />
            {fieldError('website') && <p className="text-sm text-fail">{fieldError('website')}</p>}
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              disabled={!canProceed}
              onClick={() => {
                setStep(1);
              }}
            >
              Review & create
            </Button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-text1">Review</h2>

          <dl className="space-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="font-medium text-text2">Name:</dt>
              <dd className="text-text1">{name}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium text-text2">Slug:</dt>
              <dd className="font-mono text-text1">{slug}</dd>
            </div>
            {website && (
              <div className="flex gap-2">
                <dt className="font-medium text-text2">Website:</dt>
                <dd className="text-text1">{website}</dd>
              </div>
            )}
          </dl>

          <p className="text-sm text-text3">
            Interface config (5 pages) and notification settings (8 triggers) will be created with
            defaults. Team assignment can be done after creation on the Team page.
          </p>

          {!state.ok && (
            <div className="rounded-input border border-fail/30 bg-fail/5 px-3 py-2 text-sm text-fail">
              {errors.map((e) => e.message).join('. ')}
            </div>
          )}

          <form action={formAction} className="flex gap-3 pt-2">
            <input type="hidden" name="name" value={name} />
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="website" value={website} />
            <input type="hidden" name="team" value="[]" />

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setStep(0);
              }}
            >
              Back
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? 'Creating…' : 'Create brand'}
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
