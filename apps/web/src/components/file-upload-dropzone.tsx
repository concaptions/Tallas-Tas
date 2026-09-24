'use client';

import { useCallback, useId, useRef, useState } from 'react';
import { Button, DEMO_WRITE_HINT, DisabledWrite, disabledWriteClassName } from '@tas/ui';

import type { UploadResult } from '@/lib/upload';

/**
 * The reusable attachment dropzone (PRD §5.10: briefs carry inspiration, QA docs, design files). It
 * takes files by drag-and-drop OR click, uploads each one through the `uploadFileAction` it is handed,
 * and renders the stored URLs as removable chips plus hidden inputs so they submit with whatever form
 * wraps it — the same shape the inspiration-links list already uses.
 *
 * It is dumb about storage: the `action` prop is the only way it uploads, so `@tas/ui` stays free of
 * server code and the same component works for any field. In DEMO MODE it is disabled through
 * `DisabledWrite`, and the action refuses again on the server — the disabled surface is the courtesy,
 * the action is the guarantee.
 */

/** A readable label for a stored attachment: the filename out of its URL, its key, or the URL itself. */
export function attachmentLabel(url: string): string {
  const withoutQuery = url.split(/[?#]/)[0] ?? url;
  const last = withoutQuery.split('/').pop() ?? url;
  // Storage keys are `<uuid>-<slug>`; drop the id so the chip reads the filename.
  const stripped = last.replace(/^[0-9a-f]{8}-[0-9a-f-]{27}-/i, '');
  return stripped === '' ? url : stripped;
}

export interface FileUploadDropzoneProps {
  /** The hidden-input name each stored URL submits under (read with `many()` in the action). */
  readonly name: string;
  readonly label: string;
  readonly value?: readonly string[];
  /** The file picker's `accept` attribute, e.g. "image/*,.pdf". */
  readonly accept?: string;
  readonly disabled?: boolean;
  /** The upload Server Action; the only path to storage. */
  readonly action: (previous: UploadResult | null, formData: FormData) => Promise<UploadResult>;
}

export function FileUploadDropzone({
  name,
  label,
  value = [],
  accept,
  disabled = false,
  action,
}: FileUploadDropzoneProps) {
  const [urls, setUrls] = useState<readonly string[]>(value);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const upload = useCallback(
    async (files: readonly File[]) => {
      if (disabled || files.length === 0) {
        return;
      }
      setBusy(true);
      setError(null);
      const added: string[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.set('file', file);
        const result = await action(null, formData);
        if (result.ok) {
          added.push(result.url);
        } else {
          setError(result.error);
          break;
        }
      }
      if (added.length > 0) {
        setUrls((current) => [...current, ...added]);
      }
      setBusy(false);
    },
    [action, disabled],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragging(false);
      void upload(Array.from(event.dataTransfer.files));
    },
    [upload],
  );

  const remove = useCallback((url: string) => {
    setUrls((current) => current.filter((entry) => entry !== url));
  }, []);

  return (
    <div className="flex min-w-0 flex-col gap-1.5" data-slot="file-dropzone">
      <span className="text-[11px] tracking-wide text-text3 uppercase">{label}</span>

      {urls.map((url) => (
        <input key={url} type="hidden" name={name} value={url} />
      ))}

      <DisabledWrite active={disabled} hint={DEMO_WRITE_HINT}>
        <div
          data-slot="dropzone-target"
          data-dragging={dragging}
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled) setDragging(true);
          }}
          onDragLeave={() => {
            setDragging(false);
          }}
          onDrop={disabled ? undefined : onDrop}
          className={`flex flex-col items-center gap-2 rounded-card border border-dashed border-line bg-surface2 p-4 text-center data-[dragging=true]:border-accent ${disabled ? disabledWriteClassName : ''}`}
        >
          <p className="text-[13px] text-text3">{busy ? 'Uploading…' : 'Drag files here, or'}</p>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={accept}
            multiple
            disabled={disabled || busy}
            className="hidden"
            onChange={(event) => {
              void upload(Array.from(event.target.files ?? []));
              event.target.value = '';
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || busy}
            data-slot="dropzone-pick"
            onClick={() => inputRef.current?.click()}
          >
            Choose files
          </Button>
        </div>
      </DisabledWrite>

      {error === null ? null : (
        <p data-slot="dropzone-error" className="text-xs text-bad">
          {error}
        </p>
      )}

      {urls.length === 0 ? null : (
        <ul data-slot="dropzone-files" className="flex min-w-0 flex-col gap-1">
          {urls.map((url) => (
            <li
              key={url}
              className="flex min-w-0 items-center justify-between gap-2 rounded-input border border-line bg-surface px-2 py-1"
            >
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 truncate font-mono text-xs text-text2 hover:underline"
              >
                {attachmentLabel(url)}
              </a>
              <button
                type="button"
                data-slot="dropzone-remove"
                disabled={disabled}
                onClick={() => {
                  remove(url);
                }}
                className="shrink-0 text-xs text-text3 hover:text-bad disabled:opacity-50"
                aria-label={`Remove ${attachmentLabel(url)}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
