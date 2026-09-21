import type { ReactNode } from 'react';

export default function ClientPortalLayout({ children }: { readonly children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-4 py-8">
      <header className="flex flex-col gap-1">
        <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Client Portal</p>
      </header>
      <main className="flex flex-col gap-6">{children}</main>
    </div>
  );
}
