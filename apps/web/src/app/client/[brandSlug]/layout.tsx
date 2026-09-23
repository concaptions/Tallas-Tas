import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';

import { resolveClientBrand } from '@/lib/client-brand-source';

interface Props {
  readonly children: ReactNode;
  readonly params: Promise<{ brandSlug: string }>;
}

const NAV_ITEMS = [
  { segment: 'concepts', label: 'Concepts' },
  { segment: 'briefs', label: 'Creative Briefs' },
  { segment: 'ugc', label: 'UGC Creators' },
  { segment: 'angles', label: 'Angles' },
  { segment: 'themes', label: 'Themes' },
  { segment: 'calendar', label: 'Calendar' },
] as const;

export default async function ClientBrandLayout({ children, params }: Props) {
  const { brandSlug } = await params;
  const brand = await resolveClientBrand(brandSlug);
  if (!brand) notFound();

  const basePath = `/client/${encodeURIComponent(brandSlug)}`;

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-8 md:flex-row">
      <aside className="flex shrink-0 flex-col gap-4 md:w-52">
        <div className="flex flex-col gap-1">
          <p className="font-mono text-[11px] tracking-wide text-text3 uppercase">Client Portal</p>
          <p className="text-sm font-semibold text-text">{brand.name}</p>
        </div>
        <nav className="flex flex-row gap-1 overflow-x-auto md:flex-col">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.segment}
              href={`${basePath}/${item.segment}`}
              className="rounded-input px-3 py-2 text-sm text-text2 transition-colors hover:bg-surface hover:text-text"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col gap-6">{children}</main>
    </div>
  );
}
