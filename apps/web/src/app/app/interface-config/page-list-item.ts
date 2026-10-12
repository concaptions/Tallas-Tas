import type { CustomPageColumnConfig, CustomPageFilterConfig, PageKind } from '@tas/domain';

/** One page of the brand as the Pages section lists it, projected on the server from the merged rows. */
export interface PageListItem {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly kind: PageKind;
  readonly isVisible: boolean;
  /** The brand has its own row for this slug (visibility or order of its own). */
  readonly overridden: boolean;
  /** A template row: the one kind an Admin may push to every client. */
  readonly isTemplate: boolean;
  /** The row's structure, for the Edit dialog's prefill (a custom or module page); absent on a fallback row. */
  readonly sourceTableKey?: string | null;
  readonly filterConfig?: CustomPageFilterConfig | null;
  readonly columnConfig?: readonly CustomPageColumnConfig[] | null;
}
