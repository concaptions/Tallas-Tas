'use client';

import type { OnboardingFormListRow, OnboardingFormStatus } from '@tas/db';
import { Button, DisabledWrite } from '@tas/ui';

export interface OnboardingFormItem {
  readonly form: OnboardingFormListRow;
  readonly fieldCount: number;
}

const STATUS_TONE: Record<OnboardingFormStatus, string> = {
  draft: 'bg-surface-alt text-text3',
  published: 'bg-ok/10 text-ok',
  closed: 'bg-warn/10 text-warn',
};

export function OnboardingFormsTable({
  items,
  demo,
}: {
  items: readonly OnboardingFormItem[];
  demo: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-text">Onboarding Forms</h1>
        <DisabledWrite active={demo}>
          <Button size="sm" disabled={demo}>
            New Form
          </Button>
        </DisabledWrite>
      </div>
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-text3">No onboarding forms yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-text3">
                <th className="px-2 py-2">Title</th>
                <th className="px-2 py-2">Status</th>
                <th className="px-2 py-2">Fields</th>
                <th className="px-2 py-2">Submissions</th>
                <th className="px-2 py-2">Share Token</th>
              </tr>
            </thead>
            <tbody>
              {items.map(({ form, fieldCount }) => (
                <tr key={form.id} className="border-b border-line last:border-0">
                  <td className="px-2 py-2">
                    <div className="font-semibold text-text">{form.title}</div>
                    {form.description !== null && (
                      <div className="text-xs text-text3">{form.description}</div>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <span
                      className={`rounded-input px-2 py-0.5 text-[10px] uppercase ${STATUS_TONE[form.status]}`}
                    >
                      {form.status}
                    </span>
                  </td>
                  <td className="px-2 py-2">{fieldCount}</td>
                  <td className="px-2 py-2">{form.submissionsCount}</td>
                  <td className="px-2 py-2 font-mono text-xs text-text3">{form.shareToken}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
