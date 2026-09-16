import { PRODUCT_CSV_COLUMNS } from '@tas/db';

import { isDemoMode } from '@/lib/demo-mode';
import { loadProducts } from '@/lib/products-source';
import { absoluteTime, relativeTime } from '@/lib/relative-time';

import { hostLabel } from './fields';
import { ProductsWorkspace, type ProductItem } from './products-workspace';

/**
 * Products (PRD §5.1): the landing pages every angle, concept and creative eventually points at.
 *
 * A server component, shaped exactly like the Personas page. The rows come from `loadProducts()`,
 * which is the in-repo fixtures in demo mode and the brand-scoped query otherwise; the page does not
 * know which and does not branch on it. Both pieces of table state are query parameters — `?product=`
 * for the open panel and `?q=` for the filter — so a refresh restores the view and either one is
 * shareable as a link. It renders into the shell's `<main>` and owns no frame, padding or background
 * of its own.
 *
 * Both derived strings are computed here, once: the relative timestamp with a single `now` (a client
 * that formatted it itself would disagree with the server and break hydration) and the host of each
 * link, so the table never has to shorten a URL while it renders.
 *
 * `PRODUCT_CSV_COLUMNS` is handed down as plain data rather than imported by the client component:
 * it lives in `@tas/db`, and a runtime import of that package from the browser bundle would drag the
 * driver in with it. The workspace builds the template string from these columns in the browser.
 */
interface ProductsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const [{ rows }, params] = await Promise.all([loadProducts(), searchParams]);
  const demo = isDemoMode();
  const now = new Date();

  const items: ProductItem[] = rows.map((product) => ({
    product,
    linkHost: hostLabel(product.link) ?? product.link,
    collectionHost: hostLabel(product.collectionLink),
    updatedLabel: relativeTime(product.updatedAt, now),
    updatedTitle: absoluteTime(product.updatedAt),
  }));

  const requested = params.product;
  const selection = typeof requested === 'string' && requested !== '' ? requested : null;

  const requestedSearch = params.q;
  const initialSearch = typeof requestedSearch === 'string' ? requestedSearch : '';

  return (
    <ProductsWorkspace
      items={items}
      demo={demo}
      initialSelection={selection}
      initialSearch={initialSearch}
      templateColumns={[...PRODUCT_CSV_COLUMNS]}
    />
  );
}
