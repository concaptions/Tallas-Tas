'use client';

import { startTransition, useActionState, useState } from 'react';
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@tas/ui';

import {
  addCustomFieldAction,
  deleteCustomFieldAction,
  type CustomFieldActionResult,
} from './custom-field-actions';

const TABLE_OPTIONS = [
  { value: 'products', label: 'Products' },
  { value: 'personas', label: 'Personas' },
  { value: 'angles', label: 'Angles' },
  { value: 'concepts', label: 'Concepts' },
  { value: 'creative_briefs', label: 'Creative Briefs' },
  { value: 'copywriting', label: 'Copywriting' },
  { value: 'creators', label: 'Creators' },
  { value: 'campaigns_offers', label: 'Campaigns & Offers' },
] as const;

const FIELD_TYPE_OPTIONS = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'select', label: 'Select' },
  { value: 'url', label: 'URL' },
] as const;

export interface CustomFieldItem {
  readonly id: string;
  readonly tableName: string;
  readonly fieldKey: string;
  readonly fieldLabel: string;
  readonly fieldType: string;
  readonly options: string | null;
  readonly sortOrder: string;
}

interface CustomFieldsSectionProps {
  readonly fields: readonly CustomFieldItem[];
  readonly demo: boolean;
}

export function CustomFieldsSection({ fields, demo }: CustomFieldsSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [tableName, setTableName] = useState('products');
  const [fieldType, setFieldType] = useState('text');

  const [addResult, addAction, adding] = useActionState<CustomFieldActionResult | null, FormData>(
    addCustomFieldAction,
    null,
  );
  const [deleteResult, deleteAction, deleting] = useActionState<
    CustomFieldActionResult | null,
    FormData
  >(deleteCustomFieldAction, null);

  function handleAdd(formData: FormData) {
    startTransition(() => {
      addAction(formData);
    });
    setShowForm(false);
  }

  function handleDelete(id: string) {
    const fd = new FormData();
    fd.set('id', id);
    startTransition(() => {
      deleteAction(fd);
    });
  }

  const error =
    (addResult !== null && !addResult.ok ? addResult.error : null) ??
    (deleteResult !== null && !deleteResult.ok ? deleteResult.error : null);

  return (
    <section aria-labelledby="custom-fields-heading" className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <h2 id="custom-fields-heading" className="text-sm font-medium text-text2">
          Custom Fields
        </h2>
        {!demo && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setShowForm(!showForm);
            }}
            disabled={adding}
          >
            {showForm ? 'Cancel' : 'Add Field'}
          </Button>
        )}
      </div>

      <p className="text-xs text-text4">
        Custom fields extend content tables with additional data. Fields defined here propagate to
        every child brand.
      </p>

      {error !== null && (
        <p data-slot="custom-field-error" className="text-sm text-bad">
          {error}
        </p>
      )}

      {showForm && (
        <form
          action={handleAdd}
          className="flex flex-col gap-3 rounded-card border border-line bg-surface2 p-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cf-table" className="text-xs font-medium text-text3">
                Table
              </label>
              <Select value={tableName} onValueChange={setTableName} name="tableName">
                <SelectTrigger id="cf-table">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TABLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="tableName" value={tableName} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="cf-type" className="text-xs font-medium text-text3">
                Field Type
              </label>
              <Select value={fieldType} onValueChange={setFieldType} name="fieldType">
                <SelectTrigger id="cf-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="fieldType" value={fieldType} />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="cf-key" className="text-xs font-medium text-text3">
                Field Key
              </label>
              <Input id="cf-key" name="fieldKey" placeholder="e.g. target_audience" required />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="cf-label" className="text-xs font-medium text-text3">
                Label
              </label>
              <Input id="cf-label" name="fieldLabel" placeholder="e.g. Target Audience" required />
            </div>

            {fieldType === 'select' && (
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label htmlFor="cf-options" className="text-xs font-medium text-text3">
                  Options (comma-separated)
                </label>
                <Input id="cf-options" name="options" placeholder="e.g. Option A, Option B" />
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={adding}>
              {adding ? 'Saving…' : 'Save Field'}
            </Button>
          </div>
        </form>
      )}

      <div className="rounded-card border border-line">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Table</TableHead>
              <TableHead>Key</TableHead>
              <TableHead>Label</TableHead>
              <TableHead>Type</TableHead>
              {!demo && <TableHead className="w-16" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.length === 0 ? (
              <TableRow>
                <TableCell colSpan={demo ? 4 : 5} className="text-center text-sm text-text3">
                  No custom fields defined yet.
                </TableCell>
              </TableRow>
            ) : (
              fields.map((field) => {
                const tableLabel =
                  TABLE_OPTIONS.find((o) => o.value === field.tableName)?.label ?? field.tableName;
                const typeLabel =
                  FIELD_TYPE_OPTIONS.find((o) => o.value === field.fieldType)?.label ??
                  field.fieldType;
                return (
                  <TableRow key={field.id}>
                    <TableCell className="font-mono text-xs">{tableLabel}</TableCell>
                    <TableCell className="font-mono text-xs">{field.fieldKey}</TableCell>
                    <TableCell className="text-sm">{field.fieldLabel}</TableCell>
                    <TableCell className="text-xs text-text3">{typeLabel}</TableCell>
                    {!demo && (
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-bad"
                          disabled={deleting}
                          onClick={() => {
                            handleDelete(field.id);
                          }}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
