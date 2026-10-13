import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { QA_GATE_NOTE, QA_GATE_OPEN_NOTE } from './focus-mode';
import { QaGateBox } from './qa-gate-box';

const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|rgb\(/;

describe('QaGateBox', () => {
  it('is warn-toned with the shut padlock while a required tick is missing (B4.V1)', () => {
    const html = renderToStaticMarkup(
      <QaGateBox progress="1 of 2 required checks complete." open={false} note={QA_GATE_NOTE} />,
    );

    expect(html).toContain('data-slot="focus-qa-gate"');
    expect(html).toContain('data-open="false"');
    expect(html).toContain('border-warn/35 bg-warn/10 text-warn');
    expect(html).not.toContain('text-ok');
    expect(html).toContain('lucide-lock mt-0.5');
    expect(html).not.toContain('lucide-lock-open');
    expect(html).toContain('1 of 2 required checks complete.');
    expect(html).toContain(QA_GATE_NOTE);
  });

  it('turns ok-toned with the open padlock once the gate opens (B4.V1 / B4.V2)', () => {
    const html = renderToStaticMarkup(
      <QaGateBox progress="2 of 2 required checks complete." open note={QA_GATE_OPEN_NOTE} />,
    );

    expect(html).toContain('data-open="true"');
    expect(html).toContain('border-ok/40 bg-ok/10 text-ok');
    expect(html).not.toContain('text-warn');
    expect(html).toContain('lucide-lock-open');
    expect(html).toContain(QA_GATE_OPEN_NOTE);
  });

  it('sits on the card radius and the token layer alone (B1.V29)', () => {
    const html = renderToStaticMarkup(
      <QaGateBox progress="1 of 2 required checks complete." open={false} note={QA_GATE_NOTE} />,
    );

    expect(html).toContain('rounded-card');
    expect(html).toContain('py-2.5');
    expect(html).not.toMatch(COLOUR_LITERAL);
  });
});
