// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { GridColumn } from './airtable-grid';
import { ReadOnlyFields } from './record-fields';

interface Row {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly owner: string;
}

const ROW: Row = { id: '1', name: 'Alpha', status: 'Approved', owner: 'Mia' };

const COLUMNS: readonly GridColumn<Row>[] = [
  { key: 'name', header: 'Name', render: (row) => row.name },
  { key: 'status', header: 'Status', render: (row) => row.status },
  { key: 'owner', header: 'Owner', render: (row) => row.owner },
];

afterEach(() => {
  cleanup();
});

describe('ReadOnlyFields', () => {
  it('renders every column with its header and cell under data-slot', () => {
    const { container } = render(<ReadOnlyFields columns={COLUMNS} row={ROW} slot="record" />);
    const list = container.querySelector('[data-slot="record"]');
    expect(list).not.toBeNull();
    const fields = container.querySelectorAll('[data-slot="record-field"]');
    expect(fields).toHaveLength(3);
    const names = Array.from(fields).map((element) => element.getAttribute('data-column'));
    expect(names).toEqual(['name', 'status', 'owner']);
    const html = (list as Element).innerHTML;
    expect(html).toContain('Alpha');
    expect(html).toContain('Approved');
    expect(html).toContain('Mia');
  });

  it('skips the keys listed in except', () => {
    const { container } = render(
      <ReadOnlyFields columns={COLUMNS} row={ROW} except={['owner']} slot="record" />,
    );
    const fields = container.querySelectorAll('[data-slot="record-field"]');
    expect(fields).toHaveLength(2);
    expect(container.querySelector('[data-column="owner"]')).toBeNull();
  });
});
