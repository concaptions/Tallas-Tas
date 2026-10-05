import { PRODUCT_CSV_COLUMNS } from '@tas/db';

import { loadAngles } from '@/lib/angles-source';
import { loadBriefs } from '@/lib/briefs-source';
import { loadCopy } from '@/lib/copy-source';
import { isDemoMode } from '@/lib/demo-mode';
import { loadUserViews } from '@/lib/user-view-actions';
import { loadEmailCampaigns } from '@/lib/email-campaigns-source';
import { loadProductColumns, loadProducts } from '@/lib/products-source';
import { absoluteTime, relativeTime } from '@/lib/relative-time';
import { loadCreators } from '@/lib/ugc-source';
import { loadYoutubeCopyWorkspace } from '@/lib/youtube-copywriting-source';

import {
  creativeDesignLinks,
  creatorLinks,
  creatorOptions,
  emailCampaignLinks,
  hostLabel,
  metaCopywritingLinks,
  youtubeCopyLinks,
} from './fields';
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
 * The four record links are resolved here too, from the OTHER side of each link: the email
 * campaigns, the YouTube copy rows, the briefs and the creators arrive through their own demo-aware
 * sources, each carrying the product id(s) it links to, and the `*Links` functions in `./fields`
 * index them per product into the plain `{id, label, href, chip}` lists the panel renders. Three of
 * the four are read-only; the creators are a two-way link (LINK-01), so the same rows are also
 * handed down as `creatorOptions` — every creator of the brand, which is what a picker must offer.
 * The YouTube source only exposes its whole workspace read, so its picker options are loaded and
 * dropped; the rows are what this page needs.
 *
 * `PRODUCT_CSV_COLUMNS` is handed down as plain data rather than imported by the client component:
 * it lives in `@tas/db`, and a runtime import of that package from the browser bundle would drag the
 * driver in with it. The workspace builds the template string from these columns in the browser.
 */
interface ProductsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const [
    { rows },
    { columns, unconfigured: unconfiguredColumns },
    { rows: emailCampaignRows },
    { rows: youtubeCopyRows },
    { rows: briefRows },
    { rows: creatorRows },
    { rows: angleRows },
    { rows: copyRows },
    params,
  ] = await Promise.all([
    loadProducts(),
    loadProductColumns(),
    loadEmailCampaigns(),
    loadYoutubeCopyWorkspace(),
    loadBriefs(),
    loadCreators(),
    loadAngles(),
    loadCopy(),
    searchParams,
  ]);
  const demo = isDemoMode();
  const userViews = await loadUserViews('products');
  const now = new Date();

  const items: ProductItem[] = rows.map((product) => ({
    product,
    linkHost: hostLabel(product.link) ?? product.link,
    collectionHost: hostLabel(product.collectionLink),
    updatedLabel: relativeTime(product.updatedAt, now),
    updatedTitle: absoluteTime(product.updatedAt),
    emailCampaigns: emailCampaignLinks(product.id, emailCampaignRows),
    youtubeCopy: youtubeCopyLinks(product.id, youtubeCopyRows),
    creativeDesigns: creativeDesignLinks(product.id, briefRows),
    creators: creatorLinks(product.id, creatorRows),
    // The Meta copywriting written for this product — the reverse of `copywriting.product_id`
    // (Oct 5 Linked Product control). Section on the product detail only, never a grid column.
    metaCopywriting: metaCopywritingLinks(product.id, copyRows),
    // The angle side of `angle_products`, read from the angle rows' own ids (LINK-01).
    angleIds: angleRows
      .filter((angle) => angle.productIds.includes(product.id))
      .map((angle) => angle.id),
  }));
  const angleOptions = angleRows.map(({ id, name }) => ({ id, name }));
  // The Creators field offers every creator of the brand, not only the booked ones (LINK-01).
  const creatorPickerOptions = creatorOptions(creatorRows);

  const requested = params.product;
  const selection = typeof requested === 'string' && requested !== '' ? requested : null;

  const requestedSearch = params.q;
  const initialSearch = typeof requestedSearch === 'string' ? requestedSearch : '';

  return (
    <ProductsWorkspace
      items={items}
      columns={columns}
      unconfiguredColumns={unconfiguredColumns}
      demo={demo}
      initialSelection={selection}
      initialSearch={initialSearch}
      templateColumns={[...PRODUCT_CSV_COLUMNS]}
      userViews={userViews}
      angleOptions={angleOptions}
      creatorOptions={creatorPickerOptions}
    />
  );
}
