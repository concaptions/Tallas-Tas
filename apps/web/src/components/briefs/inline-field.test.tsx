// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BriefSectionField, BriefFieldKind } from '@/app/app/creative-sheet/fields';

import { InlineField } from './inline-field';

afterEach(() => {
  cleanup();
});

const ADMIN = { actorRole: 'admin' as const, actorUserId: 'any-user' };

function field(name: string, kind: BriefFieldKind, label = name): BriefSectionField {
  return { name, label, kind, required: false, surfaces: ['sidebar', 'new-dialog', 'full-page'] };
}

const brief: Readonly<Record<string, unknown>> = {
  assignee: 'Admin User',
  batch: 'B1',
  scriptContent: 'Line one.',
  dueDate: '2026-11-01',
  priority: 'Video High',
  dimensions: ['9:16', '1:1'],
  internalStatus: 'draft',
};

describe('InlineField', () => {
  it('renders an editable Input for text kind', () => {
    const onUpdate = vi.fn(() => Promise.resolve());
    render(
      <InlineField
        {...ADMIN}
        brief={brief}
        field={field('batch', 'text', 'Batch')}
        surface="sidebar"
        onUpdate={onUpdate}
      />,
    );
    const input = screen.getByLabelText('Batch');
    expect(input.getAttribute('data-field')).toBe('batch');
    expect((input as HTMLInputElement).value).toBe('B1');
    fireEvent.change(input, { target: { value: 'B2' } });
    fireEvent.blur(input);
    expect(onUpdate).toHaveBeenCalled();
  });

  it('renders an editable Textarea for richtext kind', () => {
    const onUpdate = vi.fn(() => Promise.resolve());
    render(
      <InlineField
        {...ADMIN}
        brief={brief}
        field={field('scriptContent', 'richtext', 'Script')}
        surface="sidebar"
        onUpdate={onUpdate}
      />,
    );
    const area = screen.getByLabelText('Script');
    expect((area as HTMLTextAreaElement).value).toBe('Line one.');
    fireEvent.change(area, { target: { value: 'Line two.' } });
    fireEvent.blur(area);
    expect(onUpdate).toHaveBeenCalled();
  });

  it('renders a single-select ChipRow for singleSelect kind', () => {
    const onUpdate = vi.fn(() => Promise.resolve());
    render(
      <InlineField
        {...ADMIN}
        brief={brief}
        field={field('priority', 'singleSelect', 'Priority')}
        surface="sidebar"
        onUpdate={onUpdate}
        options={[
          { value: 'Video High', label: 'Video High' },
          { value: 'Video Average', label: 'Video Average' },
        ]}
      />,
    );
    const group = screen.getByRole('radiogroup', { name: 'Priority' });
    expect(group).toBeTruthy();
    const avgChip = screen.getByRole('radio', { name: 'Video Average' });
    fireEvent.click(avgChip);
    expect(onUpdate).toHaveBeenCalledWith({ priority: 'Video Average' });
  });

  it('renders a multi-select ChipRow for multiSelect kind', () => {
    const onUpdate = vi.fn(() => Promise.resolve());
    render(
      <InlineField
        {...ADMIN}
        brief={brief}
        field={field('dimensions', 'multiSelect', 'Dimensions')}
        surface="full-page"
        onUpdate={onUpdate}
        options={[
          { value: '9:16', label: '9:16' },
          { value: '1:1', label: '1:1' },
          { value: '4:5', label: '4:5' },
        ]}
      />,
    );
    const chips = screen.getAllByRole('checkbox');
    expect(chips).toHaveLength(3);
    fireEvent.click(screen.getByRole('checkbox', { name: '4:5' }));
    expect(onUpdate).toHaveBeenCalledWith({ dimensions: ['9:16', '1:1', '4:5'] });
  });

  it('renders a DatePicker for date kind', () => {
    const onUpdate = vi.fn(() => Promise.resolve());
    render(
      <InlineField
        {...ADMIN}
        brief={brief}
        field={field('dueDate', 'date', 'Due')}
        surface="sidebar"
        onUpdate={onUpdate}
      />,
    );
    const picker = screen.getByLabelText('Due');
    expect(picker.getAttribute('type')).toBe('date');
    fireEvent.change(picker, { target: { value: '2026-12-25' } });
    expect(onUpdate).toHaveBeenCalledWith({ dueDate: '2026-12-25' });
  });

  it('renders a readonly StatusChip for statusKey (status moves need the transition action)', () => {
    const onUpdate = vi.fn(() => Promise.resolve());
    render(
      <InlineField
        {...ADMIN}
        brief={brief}
        field={field('internalStatus', 'statusKey', 'Internal Status')}
        surface="sidebar"
        onUpdate={onUpdate}
      />,
    );
    // No editable role in the markup; the parent surface owns the dropdown + transition call.
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByLabelText('Internal Status')).toBeNull();
    // The row renders a chip in its allowed slot.
    const slot = document.querySelector('[data-slot="inline-field"][data-kind="statusKey"]');
    expect(slot?.getAttribute('data-allowed')).toBe('true');
  });

  it('falls through to readonly for user / file kinds (D-035 stop; Fix C territory)', () => {
    for (const kind of ['user', 'file'] as const) {
      const { unmount } = render(
        <InlineField
          {...ADMIN}
          brief={brief}
          field={field(`demo_${kind}`, kind, kind)}
          surface="sidebar"
          onUpdate={() => Promise.resolve()}
        />,
      );
      const slot = document.querySelector(`[data-slot="inline-field"][data-kind="${kind}"]`);
      expect(slot?.getAttribute('data-allowed')).toBe('true');
      // Nothing inside is an input or combobox.
      expect(slot?.querySelector('input, textarea, [role=radio], [role=checkbox]')).toBeNull();
      unmount();
    }
  });

  it('renders a native checkbox for checkbox kind (D-035, 2026-10-15)', () => {
    const onUpdate = vi.fn(() => Promise.resolve());
    render(
      <InlineField
        {...ADMIN}
        brief={{ ...brief, qaVideoEditor: false }}
        field={field('qaVideoEditor', 'checkbox', 'Video Editor QA')}
        surface="sidebar"
        onUpdate={onUpdate}
      />,
    );
    const input = screen.getByLabelText('Video Editor QA');
    expect(input.getAttribute('type')).toBe('checkbox');
    expect((input as HTMLInputElement).checked).toBe(false);
    fireEvent.click(input);
    expect(onUpdate).toHaveBeenCalledWith({ qaVideoEditor: true });
  });

  it('renders a single-select ChipRow for link kind with brand-scoped options (D-035)', () => {
    const onUpdate = vi.fn(() => Promise.resolve());
    render(
      <InlineField
        {...ADMIN}
        brief={{ ...brief, productId: null }}
        field={field('productId', 'link', 'Product')}
        surface="sidebar"
        onUpdate={onUpdate}
        options={[
          { value: 'prod-a', label: 'Product A' },
          { value: 'prod-b', label: 'Product B' },
        ]}
      />,
    );
    const chip = screen.getByRole('radio', { name: 'Product A' });
    fireEvent.click(chip);
    expect(onUpdate).toHaveBeenCalledWith({ productId: 'prod-a' });
  });

  it('link kind without options degrades to readonly chip (parent must supply the scope)', () => {
    render(
      <InlineField
        {...ADMIN}
        brief={{ ...brief, productId: 'prod-a' }}
        field={field('productId', 'link', 'Product')}
        surface="sidebar"
        onUpdate={() => Promise.resolve()}
      />,
    );
    const slot = document.querySelector('[data-slot="inline-field"][data-kind="link"]');
    expect(slot?.getAttribute('data-allowed')).toBe('true');
    expect(slot?.querySelector('[role=radio]')).toBeNull();
  });

  it('renders readonly when canEditBrief refuses (editor who is not the assignee)', () => {
    render(
      <InlineField
        actorRole="video_editor"
        actorUserId="Someone Else"
        brief={brief}
        field={field('batch', 'text', 'Batch')}
        surface="sidebar"
        onUpdate={() => Promise.resolve()}
      />,
    );
    expect(screen.queryByLabelText('Batch')).toBeNull();
    const slot = document.querySelector('[data-slot="inline-field"][data-surface="sidebar"]');
    expect(slot?.getAttribute('data-allowed')).toBe('false');
  });

  it('refuses the client role on every field', () => {
    render(
      <InlineField
        actorRole="client"
        actorUserId="whatever"
        brief={brief}
        field={field('batch', 'text', 'Batch')}
        surface="full-page"
        onUpdate={() => Promise.resolve()}
      />,
    );
    const slot = document.querySelector('[data-slot="inline-field"]');
    expect(slot?.getAttribute('data-allowed')).toBe('false');
  });
});
