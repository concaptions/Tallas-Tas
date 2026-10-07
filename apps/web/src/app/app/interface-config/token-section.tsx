'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, DisabledWrite, disabledWriteClassName } from '@tas/ui';

import {
  createClientTokenAction,
  listClientTokensAction,
  revokeClientTokenAction,
  type TokenListItem,
} from './token-actions';

interface TokenSectionProps {
  readonly brandId: string;
  readonly demo: boolean;
}

function formatDate(date: Date | null): string {
  if (date === null) return '—';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function TokenSection({ brandId, demo }: TokenSectionProps) {
  const [tokens, setTokens] = useState<TokenListItem[]>([]);
  const [email, setEmail] = useState('');
  const [label, setLabel] = useState('');
  const [magicLink, setMagicLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const refreshTokens = useCallback(async () => {
    const result = await listClientTokensAction(brandId);
    if (result.ok) {
      setTokens(result.tokens);
    }
  }, [brandId]);

  useEffect(() => {
    void refreshTokens();
  }, [refreshTokens]);

  const handleGenerate = useCallback(async () => {
    setError(null);
    setMagicLink(null);
    setLoading(true);
    try {
      const result = await createClientTokenAction(brandId, email, label || undefined);
      if (!result.ok) {
        setError(result.error);
      } else {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        setMagicLink(`${origin}${result.magicLinkUrl}`);
        setEmail('');
        setLabel('');
        void refreshTokens();
      }
    } finally {
      setLoading(false);
    }
  }, [brandId, email, label, refreshTokens]);

  const handleRevoke = useCallback(
    async (tokenId: string) => {
      const result = await revokeClientTokenAction(tokenId);
      if (!result.ok) {
        setError(result.error);
      } else {
        void refreshTokens();
      }
    },
    [refreshTokens],
  );

  const handleCopy = useCallback(async () => {
    if (magicLink === null) return;
    await navigator.clipboard.writeText(magicLink);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  }, [magicLink]);

  const activeTokens = tokens.filter((t) => !t.revoked);

  return (
    <section
      data-slot="token-section"
      aria-labelledby="token-heading"
      className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4"
    >
      <div className="flex flex-col gap-1">
        <h2 id="token-heading" className="text-sm font-medium text-text2">
          Client Access
        </h2>
        <p className="text-[12px] leading-snug text-text3">
          Generate magic links to give clients access to this brand&rsquo;s portal. Each link is
          tied to an email address and can be revoked at any time.
        </p>
      </div>

      {/* Generate form */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
            }}
            placeholder="client@example.com"
            className="min-w-0 flex-1 rounded-input border border-line bg-surface px-3 py-1.5 text-sm text-text placeholder:text-text4 focus:border-accent-line focus:outline-none"
          />
          <input
            type="text"
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
            }}
            placeholder="Label (optional)"
            className="min-w-0 flex-1 rounded-input border border-line bg-surface px-3 py-1.5 text-sm text-text placeholder:text-text4 focus:border-accent-line focus:outline-none"
          />
          <DisabledWrite active={demo}>
            <Button
              type="button"
              size="sm"
              disabled={demo || loading || email.trim() === ''}
              className={disabledWriteClassName}
              onClick={() => void handleGenerate()}
            >
              {loading ? 'Generating...' : 'Generate Link'}
            </Button>
          </DisabledWrite>
        </div>

        {error !== null ? (
          <p data-slot="token-error" className="text-sm text-bad">
            {error}
          </p>
        ) : null}

        {magicLink !== null ? (
          <div
            data-slot="magic-link-display"
            className="flex items-center gap-2 rounded-input border border-accent-line bg-surface2 p-2"
          >
            <code className="min-w-0 flex-1 truncate font-mono text-xs text-text2">
              {magicLink}
            </code>
            <Button type="button" variant="outline" size="sm" onClick={() => void handleCopy()}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
        ) : null}
      </div>

      {/* Active tokens list */}
      {activeTokens.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-[12px] font-medium text-text3">
            Active tokens ({String(activeTokens.length)})
          </p>
          <ul className="flex flex-col gap-1">
            {activeTokens.map((token) => (
              <li
                key={token.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-input border border-line bg-surface2 px-3 py-2"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm text-text">{token.email}</span>
                  <span className="text-[11px] text-text3">
                    {token.label !== null ? `${token.label} · ` : ''}
                    Created {formatDate(token.createdAt)}
                    {token.expiresAt !== null ? ` · Expires ${formatDate(token.expiresAt)}` : ''}
                    {token.lastUsedAt !== null
                      ? ` · Last used ${formatDate(token.lastUsedAt)}`
                      : ' · Never used'}
                  </span>
                </div>
                <DisabledWrite active={demo}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={disabledWriteClassName}
                    disabled={demo}
                    onClick={() => void handleRevoke(token.id)}
                  >
                    Revoke
                  </Button>
                </DisabledWrite>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-[12px] text-text4">No active tokens.</p>
      )}
    </section>
  );
}
