'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import {
  Button,
  DEMO_WRITE_HINT,
  disabledWriteClassName,
  DisabledWrite,
  Input,
  Label,
  Switch,
  Textarea,
} from '@tas/ui';

import { uploadLinksPath } from '@/lib/routes';

import { updateUploadLinkAction, type UploadLinkActionResult } from '../actions';

/** The plain-data shape the server component passes down (no Date objects, no db types). */
export interface UploadLinkValues {
  readonly id: string;
  readonly token: string;
  readonly label: string;
  readonly recipientName: string | null;
  readonly recipientEmail: string | null;
  readonly maxUploads: string | null;
  readonly expiresAt: string | null;
  readonly isActive: boolean;
  readonly uploadsUsed: string;
  readonly notes: string | null;
}

interface UploadLinkDetailProps {
  readonly link: UploadLinkValues;
  readonly demo: boolean;
}

/**
 * The upload link detail form. Edits an existing link; creating new links will be handled from the
 * list page. The form uses `useActionState` to submit through the Server Action and shows server
 * errors inline.
 */
export function UploadLinkDetail({ link, demo }: UploadLinkDetailProps) {
  const [state, formAction, pending] = useActionState<UploadLinkActionResult | null, FormData>(
    updateUploadLinkAction,
    null,
  );
  const [isActive, setIsActive] = useState(link.isActive);

  const blocked = demo;
  const blockedHint = demo ? DEMO_WRITE_HINT : undefined;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link
          href={uploadLinksPath}
          className="rounded-input text-sm text-text3 hover:text-text2 hover:underline"
        >
          &larr; Upload Links
        </Link>
      </div>

      <header className="flex flex-col gap-1">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Upload Link</p>
        <h1 className="text-lg font-semibold text-text">{link.label}</h1>
      </header>

      <form action={formAction} className="flex flex-col gap-6">
        <input type="hidden" name="id" value={link.id} />

        {/* Token (read-only) */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] tracking-wide text-text3 uppercase">Token</Label>
          <p className="rounded-input border border-line bg-surface2 px-3 py-2 font-mono text-sm text-text2">
            {link.token}
          </p>
        </div>

        {/* Usage (read-only) */}
        <div className="flex flex-col gap-1.5">
          <Label className="text-[11px] tracking-wide text-text3 uppercase">Uploads Used</Label>
          <p className="text-sm text-text2">
            {link.uploadsUsed}
            {link.maxUploads !== null ? ` / ${link.maxUploads}` : ''}
          </p>
        </div>

        {/* Label */}
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="upload-link-label"
            className="text-[11px] tracking-wide text-text3 uppercase"
          >
            Label
          </Label>
          <Input
            id="upload-link-label"
            name="label"
            readOnly={demo}
            defaultValue={link.label}
            placeholder="e.g. Creator upload — Summer campaign"
          />
        </div>

        {/* Recipient Name */}
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="upload-link-recipientName"
            className="text-[11px] tracking-wide text-text3 uppercase"
          >
            Recipient Name
          </Label>
          <Input
            id="upload-link-recipientName"
            name="recipientName"
            readOnly={demo}
            defaultValue={link.recipientName ?? ''}
            placeholder="Jane Doe"
          />
        </div>

        {/* Recipient Email */}
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="upload-link-recipientEmail"
            className="text-[11px] tracking-wide text-text3 uppercase"
          >
            Recipient Email
          </Label>
          <Input
            id="upload-link-recipientEmail"
            name="recipientEmail"
            type="email"
            readOnly={demo}
            defaultValue={link.recipientEmail ?? ''}
            placeholder="jane@example.com"
          />
        </div>

        {/* Max Uploads */}
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="upload-link-maxUploads"
            className="text-[11px] tracking-wide text-text3 uppercase"
          >
            Max Uploads
          </Label>
          <Input
            id="upload-link-maxUploads"
            name="maxUploads"
            readOnly={demo}
            defaultValue={link.maxUploads ?? ''}
            placeholder="Leave blank for unlimited"
          />
        </div>

        {/* Expires At */}
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="upload-link-expiresAt"
            className="text-[11px] tracking-wide text-text3 uppercase"
          >
            Expires At
          </Label>
          <Input
            id="upload-link-expiresAt"
            name="expiresAt"
            type="date"
            readOnly={demo}
            defaultValue={link.expiresAt ?? ''}
          />
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1.5">
          <Label
            htmlFor="upload-link-notes"
            className="text-[11px] tracking-wide text-text3 uppercase"
          >
            Notes
          </Label>
          <Textarea
            id="upload-link-notes"
            name="notes"
            readOnly={demo}
            defaultValue={link.notes ?? ''}
            placeholder="Internal notes about this upload link"
            className="min-h-24 leading-relaxed"
          />
        </div>

        {/* Active toggle — Radix Switch does not submit a form value, so a hidden input carries it. */}
        <div className="flex items-center gap-3">
          <Label
            htmlFor="upload-link-isActive"
            className="text-[11px] tracking-wide text-text3 uppercase"
          >
            Active
          </Label>
          <Switch
            id="upload-link-isActive"
            checked={isActive}
            onCheckedChange={setIsActive}
            disabled={demo}
          />
          <input type="hidden" name="isActive" value={isActive ? 'true' : 'false'} />
        </div>

        {/* Footer */}
        <footer className="flex flex-wrap items-center justify-end gap-3 border-t border-line pt-4">
          {demo ? (
            <p className="mr-auto text-xs text-text3">Demo mode — changes are not saved</p>
          ) : state !== null && !state.ok ? (
            <p className="mr-auto text-xs text-bad">{state.error}</p>
          ) : state !== null ? (
            <p className="mr-auto text-xs text-ok">Saved</p>
          ) : null}
          <Link href={uploadLinksPath}>
            <Button type="button" variant="outline" size="sm">
              Cancel
            </Button>
          </Link>
          <DisabledWrite active={blocked} hint={blockedHint}>
            <Button
              type="submit"
              size="sm"
              disabled={blocked || pending}
              className={disabledWriteClassName}
            >
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </DisabledWrite>
        </footer>
      </form>
    </div>
  );
}
