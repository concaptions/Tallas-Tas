/**
 * Slack DM delivery through the existing TAS Bot app (PRD §12, CLAUDE.md non-negotiable 7).
 *
 * Uses the `chat.postMessage` endpoint directly via `fetch` — no SDK dependency. The bot token
 * comes from `@tas/env`; when absent, the call is a documented no-op and returns `{ sent: false }`.
 */

export interface SlackDmResult {
  readonly sent: boolean;
  readonly error?: string;
}

export async function sendSlackDm(
  token: string | undefined,
  slackUserId: string,
  text: string,
): Promise<SlackDmResult> {
  if (!token) {
    return { sent: false, error: 'SLACK_BOT_TOKEN not configured' };
  }

  try {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({ channel: slackUserId, text }),
    });

    if (!response.ok) {
      return { sent: false, error: `Slack API HTTP ${String(response.status)}` };
    }

    const body = (await response.json()) as { ok: boolean; error?: string };
    if (!body.ok) {
      return { sent: false, error: body.error ?? 'Unknown Slack API error' };
    }

    return { sent: true };
  } catch (err) {
    return { sent: false, error: err instanceof Error ? err.message : 'Slack API call failed' };
  }
}
