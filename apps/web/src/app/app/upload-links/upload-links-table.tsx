'use client';

import type { UploadLinkListRow } from '@tas/db';
import { Button, DisabledWrite } from '@tas/ui';

export interface UploadLinkItem {
  readonly link: UploadLinkListRow;
  readonly expiresLabel: string;
  readonly usageLabel: string;
}

export function UploadLinksTable({
  items,
  demo,
}: {
  items: readonly UploadLinkItem[];
  demo: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-text1">Upload Links</h1>
        <DisabledWrite active={demo}>
          <Button size="sm" disabled={demo}>
            Create Link
          </Button>
        </DisabledWrite>
      </div>
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-text3">No upload links created yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-text3">
                <th className="px-2 py-2">Label</th>
                <th className="px-2 py-2">Recipient</th>
                <th className="px-2 py-2">Usage</th>
                <th className="px-2 py-2">Expires</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Token</th>
              </tr>
            </thead>
            <tbody>
              {items.map(({ link, expiresLabel, usageLabel }) => (
                <tr key={link.id} className="border-b border-line last:border-0">
                  <td className="px-2 py-2 font-semibold text-text1">{link.label}</td>
                  <td className="px-2 py-2">{link.recipientName ?? '—'}</td>
                  <td className="px-2 py-2">{usageLabel}</td>
                  <td className="px-2 py-2 text-text3">{expiresLabel}</td>
                  <td className="px-2 py-2">
                    <span
                      className={`rounded-input px-2 py-0.5 text-[10px] uppercase ${link.isActive ? 'bg-ok/10 text-ok' : 'bg-surface-alt text-text3'}`}
                    >
                      {link.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-2 py-2 font-mono text-xs text-text3">{link.token}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
