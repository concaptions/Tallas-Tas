import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { QaCheckRow, type QaCheckRowProps } from './qa-check-row';

function render(overrides: Partial<QaCheckRowProps> = {}): string {
  return renderToStaticMarkup(
    <ul>
      <QaCheckRow
        id="brief-qa-qaVideoEditor"
        checkKey="qaVideoEditor"
        inputSlot="brief-qa-check"
        label="Video Editor QA"
        required
        checked={false}
        onCheckedChange={vi.fn()}
        notApplicableTag="N/A · video"
        {...overrides}
      />
    </ul>,
  );
}

describe('QaCheckRow — the one QA row (B4.V3 / B4.V17)', () => {
  it('draws a required, unset tick with the warn Required tag in the mono recipe', () => {
    const html = render();

    expect(html).toContain('data-slot="qa-check-tag" data-kind="required"');
    expect(html).toMatch(/font-mono text-\[10px\] tracking-\[\.03em\] uppercase text-warn/);
    expect(html).toContain('>Required<');
    expect(html).toContain('data-applicable="true"');
  });

  it('drops the tag once a required tick is set', () => {
    const html = render({ checked: true });

    expect(html).not.toContain('data-slot="qa-check-tag"');
    expect(html).toContain('checked=""');
  });

  it('draws the N/A row: dashed box, struck-through label, the caller’s tag in text4', () => {
    const html = render({ required: false, checkKey: 'qaDesigner', label: 'Graphic Designer QA' });

    expect(html).toContain('data-variant="na"');
    expect(html).toContain('data-applicable="false"');
    expect(html).toMatch(/text-text4 line-through decoration-text4/);
    expect(html).toContain('data-kind="na"');
    expect(html).toContain('N/A · video');
    expect(html).not.toContain('>Required<');
  });

  it('keeps the caller’s input slot and the tick key on the input, for the specs', () => {
    const html = render({ inputSlot: 'focus-qa-check' });

    expect(html).toMatch(/<input[^>]*type="checkbox"[^>]*data-slot="focus-qa-check"/);
    expect(html).toMatch(/<input[^>]*data-check="qaVideoEditor"/);
    expect(html).toMatch(/<input[^>]*id="brief-qa-qaVideoEditor"/);
    expect(html).toContain('for="brief-qa-qaVideoEditor"');
  });

  it('renders the optional meta line under the label and aligns the box to the first line', () => {
    const html = render({ meta: 'Required on the video track' });

    expect(html).toContain('Required on the video track');
    expect(html).toContain('items-start');
  });

  it('disables the input when told to', () => {
    expect(render({ disabled: true })).toMatch(/<input[^>]*disabled=""/);
  });

  it('holds every colour in a token class: no literal in the markup', () => {
    const html = render() + render({ required: false }) + render({ checked: true });

    expect(html).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(html).not.toContain('rgb(');
  });
});
