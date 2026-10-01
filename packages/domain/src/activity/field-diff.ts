/**
 * The activity log's one pure function (Sprint 10, EDIT-03): which fields changed between the row
 * a Server Action read and the row it is about to write, each as `old → new` text. Written on the
 * server, from the action, never from the client — the log records what the database was told, by
 * whom, not what a form thought it was sending.
 */
export interface FieldChange {
  readonly field: string;
  readonly oldValue: string | null;
  readonly newValue: string | null;
}

/** A stored value as the log prints it: text as is, a list joined, a date as ISO, empty as null. */
export function activityValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (Array.isArray(value)) {
    const parts = value.map((entry) => activityValue(entry)).filter((entry) => entry !== null);
    return parts.length === 0 ? null : parts.join(', ');
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null;
  if (typeof value === 'string') return value.trim() === '' ? null : value;
  return null;
}

/**
 * The changes between `before` and `after` over `fields`, in field order. A field whose printed
 * value is the same on both sides is not a change (so a re-save of an untouched form logs nothing).
 */
export function diffFields<Row extends object>(
  before: Row,
  after: Partial<Row>,
  fields: readonly (keyof Row & string)[],
): readonly FieldChange[] {
  const changes: FieldChange[] = [];
  for (const field of fields) {
    if (!(field in after)) continue;
    const oldValue = activityValue(before[field]);
    const newValue = activityValue(after[field]);
    if (oldValue !== newValue) changes.push({ field, oldValue, newValue });
  }
  return changes;
}
