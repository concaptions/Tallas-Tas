import { redirect } from 'next/navigation';

interface Props {
  readonly params: Promise<{ brandSlug: string }>;
}

export default async function ClientBrandRootPage({ params }: Props) {
  const { brandSlug } = await params;
  redirect(`/client/${encodeURIComponent(brandSlug)}/concepts`);
}
