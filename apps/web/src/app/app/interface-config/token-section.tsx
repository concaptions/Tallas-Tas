'use client';

import { useActionState, useCallback, useState, useTransition } from 'react';
import {
  Button,
  DEMO_WRITE_HINT,
  DisabledWrite,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@tas/ui';
import { isTokenExpired } from '@tas/domain';

import {
  createClientTokenAction,
  revokeClientTokenAction,
  type TokenActionResult,
} from './token-actions';

interface TokenRow {
  readonly id: string;
  readonly email: string;
  readonly label: string | null;
  readonly expiresAt: Date | null;
  readonly lastUsedAt: Date | null;
  readonly revoked: boolean;
  readonly createdAt: Date;
}

interface TokenSectionProps {
  readonly tokens: readonly TokenRow[];
  readonly demo: boolean;
  readonly disabled: boolean;
}

const TOKEN_COLUMNS = ['Email', 'Label', 'Expires', 'Last Used', 'Status', ''] as const;

function formatDate(date: Date | null): string {
  if (date === null) return '—';
  return date.toISOString().slice(0, 10);
}

function tokenStatus(row: TokenRow): { label: string; className: string } {
  if (row.revoked) return { label: 'Revoked', className: 'text-text4 line-through' };
  if (row.expiresAt !== null && isTokenExpired(row.expiresAt)) {
    return { label: 'Expired', className: 'text-bad' };
  }
  return { label: 'Active', className: 'text-ok' };
}

export function TokenSection({ tokens, demo, disabled }: TokenSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [revokedIds, setRevokedIds] = useState<Set<string>>(new Set());
  const [revoking, startRevoke] = useTransition();

  const [formState, formAction, formPending] = useActionState(
    async (prev: TokenActionResult | null, formData: FormData) => {
      const result = await createClientTokenAction(prev, formData);
      if (result.ok && result.token !== undefined) {
        setCreatedToken(result.token);
        setShowForm(false);
      }
      return result;
    },
    null,
  );

  const revoke = useCallback((id: string) => {
    startRevoke(async () => {
      const result = await revokeClientTokenAction(id);
      if (result.ok) {
        setRevokedIds((prev) => new Set([...prev, id]));
      }
    });
  }, []);

  const liveTokens = tokens.map((t) => (revokedIds.has(t.id) ? { ...t, revoked: true } : t));

  return (
    <section data-slot="token-management" className="flex flex-col gap-4">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text">Client Access Tokens</h2>
          <p className="text-sm text-text3">
            Magic-link tokens for client portal access. Each token is emailed to one client contact.
          </p>
        </div>
        {disabled ? null : (
          <DisabledWrite active={demo} hint={demo ? DEMO_WRITE_HINT : undefined}>
            <Button
              size="sm"
              disabled={demo}
              onClick={() => {
                setShowForm(!showForm);
                setCreatedToken(null);
              }}
              data-slot="new-token"
            >
              {showForm ? 'Cancel' : 'New Token'}
            </Button>
          </DisabledWrite>
        )}
      </header>

      {createdToken !== null ? (
        <div
          data-slot="token-created"
          className="rounded-card border border-ok/30 bg-ok/5 px-4 py-3"
        >
          <p className="text-sm font-medium text-ok">
            Token created. Copy it now — it won't be shown again.
          </p>
          <code className="mt-1 block break-all font-mono text-xs text-text">{createdToken}</code>
        </div>
      ) : null}

      {showForm ? (
        <form
          action={formAction}
          data-slot="token-form"
          className="flex flex-wrap items-end gap-3 rounded-card border border-line bg-surface2 p-4"
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="token-email" className="text-xs font-medium text-text2">
              Email
            </label>
            <Input
              id="token-email"
              name="email"
              type="email"
              required
              placeholder="client@example.com"
              className="h-8 w-64"
            />
            {formState !== null && !formState.ok && formState.fieldErrors?.email ? (
              <p className="text-xs text-bad">{formState.fieldErrors.email}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="token-label" className="text-xs font-medium text-text2">
              Label (optional)
            </label>
            <Input
              id="token-label"
              name="label"
              type="text"
              placeholder="e.g. Marketing Lead"
              className="h-8 w-48"
            />
          </div>
          <Button type="submit" size="sm" disabled={formPending}>
            {formPending ? 'Creating…' : 'Create'}
          </Button>
          {formState !== null && !formState.ok ? (
            <p className="w-full text-xs text-bad">{formState.error}</p>
          ) : null}
        </form>
      ) : null}

      {liveTokens.length === 0 ? (
        <div className="rounded-card border border-line bg-surface px-4 py-8 text-center">
          <p className="text-sm text-text3">
            No tokens yet. Create one to give a client access to the approval portal.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card border border-line">
          <Table>
            <TableHeader>
              <TableRow>
                {TOKEN_COLUMNS.map((col) => (
                  <TableHead key={col} className="whitespace-nowrap text-xs">
                    {col}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {liveTokens.map((row) => {
                const status = tokenStatus(row);
                return (
                  <TableRow key={row.id} data-token-id={row.id}>
                    <TableCell className="text-sm">{row.email}</TableCell>
                    <TableCell className="text-sm text-text2">{row.label ?? '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{formatDate(row.expiresAt)}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {formatDate(row.lastUsedAt)}
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium ${status.className}`}>
                        {status.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      {row.revoked ? null : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={demo || revoking}
                          onClick={() => {
                            revoke(row.id);
                          }}
                          data-slot="revoke-token"
                        >
                          Revoke
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
