import { redirect } from 'next/navigation';

import type { AuthRefusal } from './verify/route';

export const dynamic = 'force-dynamic';

interface Props {
  readonly params: Promise<{ brandSlug: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** What the page says for each way a link can fail; `verify/route.ts` names the reason. */
const MESSAGES: Record<AuthRefusal, { title: string; body: string }> = {
  missing: {
    title: 'Invalid Link',
    body: 'This link is missing a token. Please use the link from your email invitation.',
  },
  brand: {
    title: 'Brand Not Found',
    body: 'The brand in this link could not be found.',
  },
  unconfigured: {
    title: 'Service Unavailable',
    body: 'The service is not fully configured. Please contact the team.',
  },
  expired: {
    title: 'Link Expired or Invalid',
    body: 'This access link has expired, been revoked, or is not valid for this brand. Please request a new link from your account manager.',
  },
};

function isRefusal(value: string | string[] | undefined): value is AuthRefusal {
  return typeof value === 'string' && value in MESSAGES;
}

/**
 * The client portal's auth page: the messages a link can end on. It sets NO cookie — a Server
 * Component cannot (Next 15), and doing so answered every valid magic link with a 500
 * (CLIENT-ACCESS-500, 2026-10-11). A request that still carries `?token=` (a link generated
 * before the fix) is handed to the `verify` Route Handler, which checks the token, sets the cookie
 * on its redirect and sends the client into the portal. Sits beside the `(portal)` group, outside
 * the token gate (`portal-gate.test.ts`).
 */
export default async function ClientAuthPage({ params, searchParams }: Props) {
  const { brandSlug } = await params;
  const resolved = await searchParams;
  const token = typeof resolved.token === 'string' ? resolved.token : null;
  if (token !== null && token !== '') {
    redirect(
      `/client/${encodeURIComponent(brandSlug)}/auth/verify?token=${encodeURIComponent(token)}`,
    );
  }
  const message = MESSAGES[isRefusal(resolved.reason) ? resolved.reason : 'missing'];
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="flex max-w-md flex-col gap-4 text-center">
        <h1 className="text-xl font-semibold text-text">{message.title}</h1>
        <p className="text-sm text-text2">{message.body}</p>
      </div>
    </div>
  );
}
