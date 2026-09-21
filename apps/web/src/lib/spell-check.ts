import { serverEnv } from '@tas/env';

export interface SpellCheckResult {
  readonly ok: true;
  readonly feedback: string;
}

export interface SpellCheckFailure {
  readonly ok: false;
  readonly error: string;
}

export type SpellCheckOutcome = SpellCheckResult | SpellCheckFailure;

const SYSTEM_PROMPT =
  'You are a copy editor reviewing advertising creative scripts. ' +
  'Check for spelling mistakes, grammar issues, inconsistent hyphenation, ' +
  'and factual claims that do not match the numbers in the text. ' +
  'Report each issue on its own line. If there are no issues, say "No issues found." ' +
  'Be concise. Do not rewrite the text.';

export async function spellCheck(text: string): Promise<SpellCheckOutcome> {
  const apiKey = serverEnv().ANTHROPIC_API_KEY;
  if (apiKey === undefined) {
    return { ok: false, error: 'ANTHROPIC_API_KEY is not configured.' };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: text }],
      }),
    });

    if (!response.ok) {
      return { ok: false, error: `Anthropic API returned ${String(response.status)}.` };
    }

    const data = (await response.json()) as {
      content: { type: string; text: string }[];
    };
    const feedback = data.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    return { ok: true, feedback: feedback || 'No issues found.' };
  } catch {
    return { ok: false, error: 'Could not reach the spell-check service.' };
  }
}

export function demoSpellCheck(text: string): SpellCheckOutcome {
  const issues: string[] = [];
  const hyphenated = text.match(/\b(\w+-\w+)\b/g) ?? [];
  const inconsistent = new Set<string>();
  for (const word of hyphenated) {
    const plain = word.replace('-', '');
    const re = new RegExp(`\\b${plain}\\b`, 'i');
    if (re.test(text)) {
      inconsistent.add(word);
    }
  }
  if (inconsistent.size > 0) {
    issues.push(`Inconsistent hyphenation: ${[...inconsistent].join(', ')}`);
  }
  return {
    ok: true,
    feedback: issues.length > 0 ? issues.join('\n') : 'No issues found.',
  };
}
