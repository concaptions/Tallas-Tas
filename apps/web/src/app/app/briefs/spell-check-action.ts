'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@clerk/nextjs/server';
import { demoBriefs, getBriefById } from '@tas/db';
import { z } from 'zod';

import { withBrandScope } from '@/lib/briefs-source';
import { isDemoMode } from '@/lib/demo-mode';
import { briefPath } from '@/lib/routes';
import { demoSpellCheck } from '@/lib/spell-check';
import { checkSpellingForBrief } from '@/lib/spell-check-runner';

export interface SpellCheckActionResult {
  readonly ok: boolean;
  readonly feedback?: string;
  readonly error?: string;
}

const schema = z.object({ id: z.uuid() });

export async function runSpellCheckAction(
  _previous: SpellCheckActionResult | null,
  formData: FormData,
): Promise<SpellCheckActionResult> {
  const parsed = schema.safeParse({ id: formData.get('id') });
  if (!parsed.success) {
    return { ok: false, error: 'Brief not identified.' };
  }
  const { id } = parsed.data;

  if (isDemoMode()) {
    const brief = demoBriefs.find((b) => b.id === id);
    if (brief === undefined) return { ok: false, error: 'Brief not found.' };
    const text = [brief.scriptContent, brief.briefToDesign].filter(Boolean).join('\n\n');
    return demoSpellCheck(text);
  }

  try {
    const actor = await auth().then((a) => a.userId);
    if (actor === null) {
      return { ok: false, error: 'Session expired.' };
    }

    const outcome = await withBrandScope(async (db, brandId) => {
      const brief = await getBriefById(db, brandId, id);
      if (brief === null) return { ok: false, error: 'Brief not found.' } as const;

      const result = await checkSpellingForBrief(db, brandId, brief, actor);
      if (result.ok) {
        revalidatePath(briefPath(id));
      }
      return result;
    });

    return outcome ?? { ok: false, error: 'No brand available.' };
  } catch {
    return { ok: false, error: 'Spell check failed.' };
  }
}
