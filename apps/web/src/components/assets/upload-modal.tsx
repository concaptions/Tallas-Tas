'use client';

import {
  useCallback,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type SyntheticEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import type { AssetCategory } from '@tas/db';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
} from '@tas/ui';

import { ASSET_MAX_BYTES } from '@/lib/r2-upload';

/**
 * Native-only drag-and-drop upload modal (CLAUDE.md "No new dependency without a note in
 * docs/decisions.md" — a DnD library would be a dependency this ticket does not need). A
 * `<label>`-wrapped `<input type="file">` opens the picker on click and the label element handles
 * `onDragOver` / `onDrop` so a dropped file lands in the same input via `DataTransfer`. The dialog
 * stays open until the request resolves; success closes it and calls `router.refresh()` so the
 * server component re-renders the list.
 *
 * ERROR BRANCHES. 503 renders the paste's not-configured copy inside the modal (not an alert); any
 * other error renders the message the API returned. The success state is a 200 with the asset row.
 */

export interface AssetUploadModalProps {
  /** The brand this upload belongs to. Checked server-side against the actor's accessible brands. */
  readonly brandId: string;
  /** The shipped vocabulary, passed in so the enum isn't duplicated. */
  readonly categories: readonly AssetCategory[];
  /** Default category highlighted when the modal opens. */
  readonly defaultCategory?: AssetCategory;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** Optional override used by the design-system story — the real UI calls the shipped endpoint. */
  readonly uploadFn?: (formData: FormData) => Promise<UploadResponse>;
}

export interface UploadResponse {
  readonly ok: boolean;
  readonly status: number;
  readonly error?: string;
  readonly detail?: string;
}

const CATEGORY_LABELS: Record<AssetCategory, string> = {
  reference: 'Reference',
  broll: 'B-Roll',
  raw_asset: 'Raw Assets',
  mood_board: 'Mood Board',
  showcase_video: 'Showcase video',
};

const ACCEPT = 'image/*,video/*,application/pdf';

/** 1,024 base, two decimals above KB. The page already carries its own `formatBytes`. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function defaultUpload(formData: FormData): Promise<UploadResponse> {
  const res = await fetch('/api/assets/upload', { method: 'POST', body: formData });
  const text = await res.text();
  let parsed: { error?: string; detail?: string } = {};
  try {
    parsed = JSON.parse(text) as typeof parsed;
  } catch {
    // non-JSON — leave `parsed` empty and fall back to the status text below.
  }
  return { ok: res.ok, status: res.status, error: parsed.error, detail: parsed.detail };
}

export function AssetUploadModal({
  brandId,
  categories,
  defaultCategory,
  open,
  onOpenChange,
  uploadFn = defaultUpload,
}: AssetUploadModalProps) {
  const router = useRouter();
  const fileInputId = useId();
  const categorySelectId = useId();
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState<AssetCategory>(
    defaultCategory ?? categories[0] ?? 'reference',
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setFile(null);
    setError(null);
    setPending(false);
    setDragActive(false);
    onOpenChange(false);
  }, [onOpenChange]);

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.files?.[0] ?? null;
    setFile(next);
    setError(null);
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragActive(false);
    const files = event.dataTransfer.files;
    const dropped = files.length > 0 ? files[0] : null;
    if (dropped !== null && dropped !== undefined) {
      setFile(dropped);
      setError(null);
      // Mirror the dropped file into the input so a subsequent submit without a click re-selects.
      if (inputRef.current !== null) {
        const dt = new DataTransfer();
        dt.items.add(dropped);
        inputRef.current.files = dt.files;
      }
    }
  };

  const onDragOver = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragActive(true);
  };

  const onDragLeave = () => {
    setDragActive(false);
  };

  const runUpload = useCallback(
    async (chosen: File) => {
      setPending(true);
      setError(null);

      const formData = new FormData();
      formData.append('brandId', brandId);
      formData.append('category', category);
      formData.append('file', chosen);

      const result = await uploadFn(formData);
      setPending(false);
      if (result.ok) {
        router.refresh();
        close();
        return;
      }
      if (result.status === 503) {
        setError('Storage not configured — set R2 credentials in the environment.');
        return;
      }
      setError(result.error ?? `Upload failed (HTTP ${String(result.status)}).`);
    },
    [brandId, category, uploadFn, router, close],
  );

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (file === null) {
      setError('Pick a file first.');
      return;
    }
    if (file.size > ASSET_MAX_BYTES) {
      setError(`File is larger than the ${String(ASSET_MAX_BYTES / 1024 / 1024)} MB limit.`);
      return;
    }
    void runUpload(file);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
        else onOpenChange(true);
      }}
    >
      <DialogContent data-slot="asset-upload-dialog">
        <DialogHeader>
          <DialogTitle>Upload asset</DialogTitle>
          <DialogDescription>
            Images, videos and PDFs are accepted. Max {String(ASSET_MAX_BYTES / 1024 / 1024)} MB.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={fileInputId}>File</Label>
            <label
              htmlFor={fileInputId}
              data-slot="asset-drop-zone"
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={`flex min-h-24 flex-col items-center justify-center gap-1 rounded-card border border-dashed p-6 text-center text-sm text-text3 transition-colors ${
                dragActive ? 'border-accent bg-surface-alt' : 'border-line bg-surface2'
              }`}
            >
              {file === null ? (
                <>
                  <span className="text-text2">Drop a file here or click to browse</span>
                  <span className="text-xs text-text3">
                    Images (image/*), videos (video/*), or application/pdf
                  </span>
                </>
              ) : (
                <span data-slot="asset-selected" className="font-mono text-text">
                  {file.name} — {formatBytes(file.size)}
                </span>
              )}
              <input
                ref={inputRef}
                id={fileInputId}
                data-slot="asset-file-input"
                type="file"
                accept={ACCEPT}
                onChange={onFileChange}
                className="hidden"
              />
            </label>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={categorySelectId}>Category</Label>
            <select
              id={categorySelectId}
              data-slot="asset-category"
              value={category}
              onChange={(event) => {
                const next = event.target.value;
                if ((categories as readonly string[]).includes(next)) {
                  setCategory(next as AssetCategory);
                }
              }}
              className="rounded-input border border-line bg-surface px-3 py-1.5 text-sm text-text"
            >
              {categories.map((key) => (
                <option key={key} value={key}>
                  {CATEGORY_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          {error !== null && (
            <p
              data-slot="asset-upload-error"
              className="rounded-input bg-surface3 px-3 py-2 text-sm text-text2"
            >
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={close} disabled={pending}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              data-slot="asset-upload-submit"
              disabled={pending || file === null}
            >
              {pending ? 'Uploading…' : 'Upload'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
