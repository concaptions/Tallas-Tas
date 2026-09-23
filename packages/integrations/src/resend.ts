/**
 * Email delivery through Resend (PRD §12: email is a per-user toggle, off by default).
 *
 * Uses the Resend REST API directly via `fetch` — no SDK dependency. The API key comes from
 * `@tas/env`; when absent, the call is a documented no-op and returns `{ sent: false }`.
 */

export interface ResendEmailResult {
  readonly sent: boolean;
  readonly error?: string;
}

export interface ResendEmailInput {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
}

export async function sendEmail(
  apiKey: string | undefined,
  input: ResendEmailInput,
): Promise<ResendEmailResult> {
  if (!apiKey) {
    return { sent: false, error: 'RESEND_API_KEY not configured' };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'TAS Creative Platform <notifications@tas.digital>',
        to: input.to,
        subject: input.subject,
        text: input.text,
      }),
    });

    if (!response.ok) {
      const body = (await response.json()) as { message?: string };
      return { sent: false, error: body.message ?? `Resend API HTTP ${String(response.status)}` };
    }

    return { sent: true };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : 'Resend API call failed' };
  }
}
