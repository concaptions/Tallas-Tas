import type { ReactNode } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  DEMO_WRITE_HINT,
  disabledWriteClassName,
  DisabledWrite,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SoonChip,
  StatusChip,
  StepRow,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  TwoTrackApproval,
} from '@tas/ui';
import {
  CLIENT_STATUS,
  INTERNAL_VIDEO_STATUS,
  ON_HOLD,
  chipTone,
  type ChipTone,
} from '@tas/domain/state';
import { brandRoles, brandStatuses } from '@tas/domain';

import {
  ANGLE_FORMATS,
  ANGLE_TYPES,
  chipLabel,
  FORMAT_CHIP_TONE,
  formatChipRow,
  overflowLabel,
  PERSONA_CHIP_TONE,
  PRODUCT_CHIP_TONE,
  TYPE_SOON_HINT,
} from '@/app/app/angles/fields';
import { InspoCard } from '@/app/app/angles/inspo-card';
import { conceptCountLabel, conceptCountTone, EM_DASH, hostLabel } from '@/app/app/products/fields';
import {
  ALL_CATEGORIES,
  CATEGORY_FILTERS,
  DEMO_DIALOG_NOTICE,
  libraryCountLabel,
  REFERENCE_LINKS_SOON_HINT,
  THEME_CATEGORIES,
  type ThemeCardRow,
} from '@/app/app/themes/fields';
import { GlobalBadge } from '@/app/app/themes/global-badge';
import { ThemeCard } from '@/app/app/themes/theme-card';

import {
  BriefChipsStory,
  BriefDimensionsStory,
  BriefInspirationStory,
  BriefNameStory,
  BriefQaStory,
} from './briefs.stories';
import {
  ConceptNamePreviewStory,
  ConceptsBoardStory,
  ConceptsViewToggleStory,
} from './concepts.stories';
import {
  CopyCounterStory,
  CopyLinkedCreativeStory,
  CopyStatusChipsStory,
} from './copywriting.stories';
import { AdsToLaunchRowStory } from './ads-to-launch.stories';
import { ClientQueueCardStory, ClientQueueColumnStory } from './client-queue-card.stories';
import {
  ConfigToggleStory,
  InterfaceConfigEmptyStory,
  InterfaceConfigStory,
} from './interface-config.stories';
import {
  NotificationRoutingNoteStory,
  NotificationTableDemoStory,
  NotificationTableStory,
  NotificationsEmptyStory,
} from './notifications.stories';
import {
  DiffPreviewStory,
  PromotionTableDemoStory,
  PromotionTableStory,
  PropagationEmptyStory,
  PropagationFilterStory,
  PropagationNoteStory,
} from './propagation.stories';
import { QueueCardStory, QueueColumnStory } from './queue-card.stories';
import { TeamEmptyStory, TeamTableStory } from './team.stories';
import { CreatorCardStory, PartnershipCountdownStory } from './ugc.stories';

export const metadata = {
  title: 'Design system — TAS Creative Platform',
};

const PALETTE = [
  'bg',
  'bg-deep',
  'surface',
  'surface2',
  'surface3',
  'surface4',
  'line',
  'line2',
  'text',
  'text2',
  'text3',
  'text4',
  'accent',
  'accent-line',
  'accent-soft',
  'ok',
  'warn',
  'bad',
  'info',
] as const;

const TONES: ChipTone[] = ['ok', 'warn', 'bad', 'info', 'accent', 'mute'];

/** Two rows in the Products shape: one with a collection link and a concept, one with neither. */
const SAMPLE_PRODUCTS = [
  {
    name: 'Niagara Deep Sleep Weighted Blanket',
    link: 'https://niagarasleep.example/products/deep-sleep-weighted-blanket',
    collectionLink: 'https://www.niagarasleep.example/collections/sleep-essentials',
    conceptCount: 1,
  },
  {
    name: 'Niagara Cooling Blackout Sleep Mask',
    link: 'https://niagarasleep.example/products/cooling-blackout-sleep-mask',
    collectionLink: null,
    conceptCount: 0,
  },
] as const;

/** Three rows in the Angles shape: both links, a four-format row that collapses, and neither link. */
const SAMPLE_ANGLES = [
  {
    name: 'It Is Not Just Your Age',
    personaName: 'Denise — peri-menopausal, awake at 3am with night sweats',
    productName: 'Niagara Deep Sleep Weighted Blanket',
    formats: ['Static', 'Video', 'Carousel'],
  },
  {
    name: 'Make 9am Look Like 3am',
    personaName: 'Marcus — the rotating-shift nurse who cannot switch off',
    productName: 'Niagara Cooling Blackout Sleep Mask',
    formats: ['Static', 'Video', 'Carousel', 'Motion Graphic'],
  },
  {
    name: 'Unlinked draft',
    personaName: null,
    productName: null,
    formats: [],
  },
] as const satisfies readonly {
  name: string;
  personaName: string | null;
  productName: string | null;
  formats: readonly string[];
}[];

/** One of each source `parseInspoLink` recognises, plus a URL it does not. */
const SAMPLE_INSPO = [
  'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=CA&id=982254173318827',
  'https://www.tiktok.com/@thepostpartumplan/video/7385012994771635745',
  'https://www.youtube.com/watch?v=nm1TxQj9IsQ',
  'https://swipe-file.example/collections/sleep-hooks-q3',
] as const;

/**
 * Three rows in the Themes shape, one per category: a card with links and a long note that clamps,
 * a card that is actually in use (the singular "1 brand" case), and a card with neither note nor
 * link, so the grid's shortest possible card is on this page too.
 */
const SAMPLE_THEMES = [
  {
    id: 'ds-theme-1',
    name: 'Yapper Style',
    category: 'Production Style',
    status: 'in_progress',
    notes:
      'One creator, one take, talking straight down the barrel at conversational speed with no B-roll to hide behind — the whole thing lives or dies on the first sentence. Cheapest format we shoot and the only one that survives being cut to six different hooks in the edit.',
    referenceLinks: [
      'https://foreplay.example/boards/yapper-style-dtc',
      'https://www.tiktok.com/@thepostpartumplan/video/7385012994771635745',
    ],
    usedByBrandCount: 0,
    isActive: true,
  },
  {
    id: 'ds-theme-2',
    name: 'Problem/Solution',
    category: 'Framework',
    status: 'done',
    notes: 'Name the problem in the first two seconds, then show the product solving it.',
    referenceLinks: ['https://foreplay.example/boards/problem-solution'],
    usedByBrandCount: 1,
    isActive: true,
  },
  {
    id: 'ds-theme-3',
    name: 'Holiday Gifting',
    category: 'Seasonal',
    status: null,
    notes: null,
    referenceLinks: null,
    usedByBrandCount: 4,
    isActive: false,
  },
] as const satisfies readonly ThemeCardRow[];

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-line pt-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-text">{title}</h2>
        {note === undefined ? null : <p className="text-sm text-text3">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function PaletteColumn({ theme }: { theme: 'dark' | 'light' }) {
  return (
    <div data-theme={theme} className="flex-1 rounded-card border border-line bg-bg p-4 text-text">
      <h3 className="mb-3 font-mono text-xs tracking-wide text-text3 uppercase">
        warm {theme}
        {theme === 'dark' ? ' (default)' : ' (data-theme="light")'}
      </h3>
      <ul className="flex flex-col gap-1.5">
        {PALETTE.map((token) => (
          <li key={token} className="flex items-center gap-3">
            <span
              className="size-7 shrink-0 rounded-input border border-line2"
              style={{ backgroundColor: `var(--${token})` }}
            />
            <span className="font-mono text-[11px] text-text2">--{token}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function DesignSystemPage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 p-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold text-text">Design system</h1>
        <p className="rounded-card border border-accent-line bg-accent-soft p-3 text-sm text-text">
          This page is the style reference. Every component in the product must match. Deviations
          require a decision entry in docs/decisions.md.
        </p>
        <p className="text-sm text-text3">
          Colours come from{' '}
          <span className="font-mono text-text2">packages/ui/src/styles/tokens.css</span>, status
          values from <span className="font-mono text-text2">@tas/domain/state</span>, and the
          status primitives from <span className="font-mono text-text2">@tas/ui</span>. A hex
          literal in a component fails{' '}
          <span className="font-mono text-text2">packages/ui/src/styles/no-hex.test.ts</span>.
        </p>
      </header>

      <Section
        title="Palette"
        note="Both themes side by side. Warm dark is the default; a container with data-theme='light' re-themes everything inside it."
      >
        <div className="flex flex-col gap-4 sm:flex-row">
          <PaletteColumn theme="dark" />
          <PaletteColumn theme="light" />
        </div>
      </Section>

      <Section
        title="Typography"
        note="Inter 400/500/600 for the interface. JetBrains Mono 400/500 for auto-generated system output: concept names, creative names, IDs."
      >
        <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5">
          <p className="text-2xl font-semibold text-text">Display 24 / 600 — Workspace</p>
          <p className="text-lg font-semibold text-text">Heading 18 / 600 — Creative briefs</p>
          <p className="text-base font-medium text-text">Subheading 16 / 500 — Batch 12</p>
          <p className="text-sm text-text2">Body 14 / 400 — The client sees only the client bar.</p>
          <p className="text-xs text-text3">Caption 12 / 400 — Updated 4 minutes ago</p>
          <p className="font-mono text-sm text-text2">Mono 14 / 400 — TOFVID001-B12-HOOK-V2</p>
          <p className="font-mono text-xs text-text3">Mono 12 / 400 — 8f2c1d90-5d4a-4c1e-9f11</p>
        </div>
      </Section>

      <Section
        title="Buttons"
        note="Six variants, four sizes. 6px radius: the system has no pill buttons."
      >
        <div className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
            <Button variant="destructive">Destructive</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="default">Default</Button>
            <Button size="lg">Large</Button>
            <Button size="icon" aria-label="Icon button">
              +
            </Button>
          </div>
        </div>
      </Section>

      <Section title="Card">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Concept</CardTitle>
            <CardDescription>Batch-Angle-Theme, generated never typed.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-sm text-text2">B12-HOOK-WINTER</p>
          </CardContent>
          <CardFooter>
            <Button size="sm" variant="outline">
              Open
            </Button>
          </CardFooter>
        </Card>
      </Section>

      <Section title="Form controls">
        <div className="grid gap-5 rounded-card border border-line bg-surface p-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ds-input">Brand name</Label>
            <Input id="ds-input" placeholder="Acme Supplements" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ds-input-invalid">Invalid input</Label>
            <Input id="ds-input-invalid" aria-invalid defaultValue="not a url" />
          </div>
          <div className="flex flex-col gap-2 sm:col-span-2">
            <Label htmlFor="ds-textarea">Brief</Label>
            <Textarea id="ds-textarea" placeholder="What is this creative testing?" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ds-select">Brand role</Label>
            <Select>
              <SelectTrigger id="ds-select" className="w-full">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {brandRoles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3 self-end">
            <Switch id="ds-switch" defaultChecked />
            <Label htmlFor="ds-switch">Email notifications</Label>
          </div>
        </div>
      </Section>

      <Section title="Badge" note="Generic badge. A status badge is always StatusChip, never this.">
        <div className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-surface p-5">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Destructive</Badge>
        </div>
      </Section>

      <Section title="Table">
        <div className="rounded-card border border-line bg-surface p-5">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Creative</TableHead>
                <TableHead>Brand status</TableHead>
                <TableHead>Internal status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {brandStatuses.map((status, index) => {
                const entry = INTERNAL_VIDEO_STATUS[index + 2] ?? INTERNAL_VIDEO_STATUS[0];
                return (
                  <TableRow key={status}>
                    <TableCell className="font-mono text-xs text-text2">
                      TOFVID00{index + 1}-B12-HOOK-V1
                    </TableCell>
                    <TableCell className="text-text2">{status}</TableCell>
                    <TableCell>
                      <StatusChip tone={chipTone(entry.label)} label={entry.label} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Section>

      <Section title="Tabs, dropdown menu and dialog">
        <div className="flex flex-col gap-5 rounded-card border border-line bg-surface p-5">
          <Tabs defaultValue="video">
            <TabsList>
              <TabsTrigger value="video">Video</TabsTrigger>
              <TabsTrigger value="static">Static</TabsTrigger>
            </TabsList>
            <TabsContent value="video" className="pt-3 text-sm text-text2">
              The video track runs through an editor.
            </TabsContent>
            <TabsContent value="static" className="pt-3 text-sm text-text2">
              The static track runs through a designer, and needs no concept.
            </TabsContent>
          </Tabs>

          <div className="flex flex-wrap items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Creative</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  Duplicate
                  <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem>Assign editor</DropdownMenuItem>
                <DropdownMenuItem variant="destructive">Archive</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  Open dialog
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Promote to parent template</DialogTitle>
                  <DialogDescription>
                    Nothing auto-promotes. An admin approves this from the Admin dashboard.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="ghost" size="sm">
                      Cancel
                    </Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button size="sm">Request promotion</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </Section>

      <Section
        title="StatusChip"
        note="Every tone. The tone is never chosen by hand: chipTone(label) from @tas/domain/state decides."
      >
        <div className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5">
          <div className="flex flex-wrap items-center gap-3">
            {TONES.map((tone) => (
              <StatusChip key={tone} tone={tone} label={tone} />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
            {[...INTERNAL_VIDEO_STATUS, ...CLIENT_STATUS, ON_HOLD].map((entry, index) => (
              <StatusChip
                key={`${entry.key}-${String(index)}`}
                tone={chipTone(entry.label)}
                label={entry.label}
              />
            ))}
            <StatusChip tone="mute" label="locked" />
          </div>
        </div>
      </Section>

      <Section
        title="SoonChip and disabled write actions"
        note="A section that is not built yet carries a SoonChip. A write action disabled because no session exists is muted, never accent, and explains itself on hover."
      >
        <div className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5">
          <div className="flex flex-wrap items-center gap-3">
            <SoonChip />
            <span className="text-sm text-text3">
              Sidebar sections and menu items that have no page yet.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <Button size="sm">Save</Button>
            <DisabledWrite>
              <Button size="sm" disabled className={disabledWriteClassName}>
                Save
              </Button>
            </DisabledWrite>
            <span className="text-sm text-text3">
              Enabled, then the same button disabled in demo mode: hover it for {DEMO_WRITE_HINT}.
            </span>
          </div>
        </div>
      </Section>

      <Section
        title="Data table row (Products)"
        note="The shape every per-brand table uses. A long URL is shortened to its host with the full link in the cell's title, an optional link that is absent renders the em dash from the route's fields.ts, and a derived count is a StatusChip — info above zero, mute at zero. A count is not a status: this table has none, and invents none."
      >
        <div className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm">New product</Button>
            <DisabledWrite>
              <Button variant="outline" size="sm" disabled className={disabledWriteClassName}>
                Upload CSV
              </Button>
            </DisabledWrite>
            <Button variant="outline" size="sm">
              Download template
            </Button>
            <span className="text-sm text-text3">
              Download template stays enabled without a session: it builds the CSV in the browser
              and writes nothing.
            </span>
          </div>
          <div className="overflow-x-auto border-t border-line pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product name</TableHead>
                  <TableHead>Landing page URL</TableHead>
                  <TableHead>Collection link</TableHead>
                  <TableHead>Linked concepts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SAMPLE_PRODUCTS.map((row) => (
                  <TableRow key={row.name}>
                    <TableCell className="font-medium text-text">{row.name}</TableCell>
                    <TableCell className="text-text2" title={row.link}>
                      {hostLabel(row.link)}
                    </TableCell>
                    <TableCell className="text-text2" title={row.collectionLink ?? undefined}>
                      {hostLabel(row.collectionLink) ?? (
                        <span className="text-text4">{EM_DASH}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusChip
                        tone={conceptCountTone(row.conceptCount)}
                        label={conceptCountLabel(row.conceptCount)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </Section>

      <Section
        title="Linked-row chips, format chips and the ad-inspiration card (Angles)"
        note="What the Angles page introduces. A chip that carries a linked row's name is info for a persona and mute for a product, and it shows the half of the name before the em dash with the whole string in the cell's title. Format chips are accent, always in ANGLE_FORMATS order, and collapse to +N past three so a row never wraps. The ad-inspiration card is built from parseInspoLink alone — no fetch, no embed dependency, no loading state — so an unrecognised URL still renders a source, a host and a title."
      >
        <div className="flex flex-col gap-5 rounded-card border border-line bg-surface p-5">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Persona</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Formats</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SAMPLE_ANGLES.map((row) => {
                  const chips = formatChipRow(row.formats);
                  return (
                    <TableRow key={row.name}>
                      <TableCell className="font-medium text-text">{row.name}</TableCell>
                      <TableCell title={row.personaName ?? undefined}>
                        {row.personaName === null ? (
                          <span className="text-text4">{EM_DASH}</span>
                        ) : (
                          <StatusChip tone={PERSONA_CHIP_TONE} label={chipLabel(row.personaName)} />
                        )}
                      </TableCell>
                      <TableCell title={row.productName ?? undefined}>
                        {row.productName === null ? (
                          <span className="text-text4">{EM_DASH}</span>
                        ) : (
                          <StatusChip tone={PRODUCT_CHIP_TONE} label={chipLabel(row.productName)} />
                        )}
                      </TableCell>
                      <TableCell>
                        {chips.shown.length === 0 ? (
                          <span className="text-text4">{EM_DASH}</span>
                        ) : (
                          <span className="flex flex-nowrap items-center gap-1">
                            {chips.shown.map((entry) => (
                              <StatusChip
                                key={entry.key}
                                tone={FORMAT_CHIP_TONE}
                                label={entry.label}
                              />
                            ))}
                            {chips.overflow === 0 ? null : (
                              <StatusChip tone="mute" label={overflowLabel(chips.overflow)} />
                            )}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <div className="grid gap-2 border-t border-line pt-4 sm:grid-cols-2">
            {SAMPLE_INSPO.map((url) => (
              <InspoCard key={url} url={url} />
            ))}
          </div>

          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <span className="font-mono text-[11px] tracking-wide text-text3 uppercase">
              Format toggles, then the inert Type toggles
            </span>
            <div className="flex flex-wrap gap-2">
              {ANGLE_FORMATS.map((entry, index) => (
                <span
                  key={entry.key}
                  className={
                    index < 2
                      ? 'rounded-input border border-accent-line bg-accent-soft px-2.5 py-1 font-mono text-[11px] tracking-wide text-accent uppercase'
                      : 'rounded-input border border-line bg-surface2 px-2.5 py-1 font-mono text-[11px] tracking-wide text-text3 uppercase'
                  }
                >
                  {entry.label}
                </span>
              ))}
            </div>
            <DisabledWrite hint={TYPE_SOON_HINT}>
              <span className="flex flex-wrap items-center gap-2">
                <SoonChip />
                {ANGLE_TYPES.map((entry, index) => (
                  <span
                    key={entry.key}
                    className={
                      index === 0
                        ? 'rounded-input border border-line2 bg-surface3 px-2.5 py-1 font-mono text-[11px] tracking-wide text-text2 uppercase'
                        : 'rounded-input border border-line bg-surface2 px-2.5 py-1 font-mono text-[11px] tracking-wide text-text4 uppercase'
                    }
                  >
                    {entry.label}
                  </span>
                ))}
              </span>
            </DisabledWrite>
          </div>
        </div>
      </Section>

      <Section
        title="Themes — the GLOBAL library"
        note="The badge, the card and the filter row the /app/themes page is built from. Themes are the one table that is not per-brand, so the badge is part of the page rather than decoration on it."
      >
        <div className="flex flex-col gap-5 rounded-card border border-line bg-surface p-5">
          <GlobalBadge />

          <p className="text-sm text-text2">
            <span className="font-mono text-text2">{libraryCountLabel(SAMPLE_THEMES.length)}</span>{' '}
            — the count under the heading covers every brand on the platform, never one workspace.
          </p>

          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <span className="font-mono text-[11px] tracking-wide text-text3 uppercase">
              Category filters — All, then the three kinds in vocabulary order
            </span>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_FILTERS.map((entry) => (
                <span
                  key={entry.key}
                  className={
                    entry.key === ALL_CATEGORIES
                      ? 'rounded-input border border-accent-line bg-accent-soft px-2.5 py-1 font-mono text-[11px] tracking-wide text-accent uppercase'
                      : 'rounded-input border border-line bg-surface2 px-2.5 py-1 font-mono text-[11px] tracking-wide text-text3 uppercase'
                  }
                >
                  {entry.label}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <span className="font-mono text-[11px] tracking-wide text-text3 uppercase">
              Category chips — one fixed tone per kind, from THEME_CATEGORIES
            </span>
            <div className="flex flex-wrap gap-2">
              {THEME_CATEGORIES.map((entry) => (
                <StatusChip key={entry.key} tone={entry.tone} label={entry.label} />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <span className="font-mono text-[11px] tracking-wide text-text3 uppercase">
              Theme cards — name, category chip, usage line, clamped note, host-only link chips
            </span>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {SAMPLE_THEMES.map((row) => (
                <ThemeCard key={row.id} theme={row} demo onToggled={() => {}} />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-line pt-4">
            <span className="font-mono text-[11px] tracking-wide text-text3 uppercase">
              New theme dialog, in demo mode: trigger and save inert, reference links not yet
              writable
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <DisabledWrite hint={DEMO_WRITE_HINT}>
                <Button size="sm" disabled className={disabledWriteClassName}>
                  New theme
                </Button>
              </DisabledWrite>
              <DisabledWrite hint={REFERENCE_LINKS_SOON_HINT}>
                <span className="inline-flex items-center gap-2">
                  <SoonChip />
                  <span className="text-xs text-text3">Reference Links</span>
                </span>
              </DisabledWrite>
              <span className="text-xs text-text3">{DEMO_DIALOG_NOTICE}</span>
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="StepRow"
        note="Done, now and next, plus the optional side badge that carries a non-linear state."
      >
        <div className="max-w-md rounded-card border border-line bg-surface p-5">
          <StepRow label="Sent to Video Editor" tip="Assigned to an editor." state="done" />
          <StepRow
            label="Video Editing in Progress"
            tip="Editor opened the brief and claimed it."
            state="now"
            badge={<StatusChip tone={chipTone(ON_HOLD.label)} label={ON_HOLD.label} />}
          />
          <StepRow label="Ad Submitted" tip="Editor uploaded a cut." state="next" isLast />
        </div>
      </Section>

      <Section
        title="Concepts: view toggle, board and auto-name"
        note="The three shapes /app/concepts introduces. Mounted from the route's own modules, never re-drawn here."
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[11px] tracking-wide text-text3 uppercase">
              view toggle — two controls, no pill, written to ?view=
            </h3>
            <ConceptsViewToggleStory />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[11px] tracking-wide text-text3 uppercase">
              board — one column per internal status, empties kept, count on the status chip
            </h3>
            <ConceptsBoardStory />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[11px] tracking-wide text-text3 uppercase">
              auto-name — font-mono, never an input, complete and half-filled
            </h3>
            <ConceptNamePreviewStory />
          </div>
        </div>
      </Section>

      <Section
        title="Creative Briefs: generated name, chips, ratios, inspiration and QA"
        note="The five shapes /app/briefs introduces. Mounted from the route's own modules, never re-drawn here."
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[11px] tracking-wide text-text3 uppercase">
              creative name — font-mono, never an input, copy confirms in place
            </h3>
            <BriefNameStory />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[11px] tracking-wide text-text3 uppercase">
              chips — standalone in the mute tone, priority toned by its SLA, status from chipTone
            </h3>
            <BriefChipsStory />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[11px] tracking-wide text-text3 uppercase">
              dimensions — the PRD §8 defaults, video set then static set
            </h3>
            <BriefDimensionsStory />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[11px] tracking-wide text-text3 uppercase">
              inspiration — embed where a provider allows it, a card where it does not
            </h3>
            <BriefInspirationStory />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[11px] tracking-wide text-text3 uppercase">
              QA checklist — three boxes, disabled in demo mode with the reason on hover
            </h3>
            <BriefQaStory />
          </div>
        </div>
      </Section>

      <Section
        title="Copywriting: status chips, the linked-creative cell and the character counter"
        note="The three shapes /app/copywriting introduces. Mounted from the route's own modules, never re-drawn here."
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[11px] tracking-wide text-text3 uppercase">
              copy status — the five PRD §5.11 states, toned by copyStatusTone
            </h3>
            <CopyStatusChipsStory />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[11px] tracking-wide text-text3 uppercase">
              linked creative — a mono chip linking to the brief, or the muted em dash
            </h3>
            <CopyLinkedCreativeStory />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[11px] tracking-wide text-text3 uppercase">
              character counter — used of the guide, warn at it, bad past it, never a block
            </h3>
            <CopyCounterStory />
          </div>
        </div>
      </Section>

      <Section
        title="UGC Management: the creator card and the partnership countdown"
        note="The two shapes /app/ugc introduces. Mounted from the route's own components, never re-drawn here."
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[11px] tracking-wide text-text3 uppercase">
              creator card — avatar or initials, and the three tracks each under its own review
            </h3>
            <CreatorCardStory />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[11px] tracking-wide text-text3 uppercase">
              partnership countdown — expiring, active, expired, and never activated
            </h3>
            <PartnershipCountdownStory />
          </div>
        </div>
      </Section>

      <Section
        title="Internal Queue: the card and the column"
        note="The two shapes /app/queue/internal introduces. Mounted from the route's own component and its own fields module, never re-drawn here."
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[11px] tracking-wide text-text3 uppercase">
              queue card — mono name, labelled tile, assignee, priority chip; no chip when unset
            </h3>
            <QueueCardStory />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[11px] tracking-wide text-text3 uppercase">
              queue column — PRD §9 order from the domain, empty columns kept, strip scrolls alone
            </h3>
            <QueueColumnStory />
          </div>
        </div>
      </Section>

      <Section
        title="Client Queue: the card and the column"
        note="The two shapes /app/queue/client introduces. Mounted from the route's own component and the strip both boards share, never re-drawn here."
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[11px] tracking-wide text-text3 uppercase">
              client queue card — the shared face, the client chip, only the writes the state
              machine allows, disabled with a tooltip
            </h3>
            <ClientQueueCardStory />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[11px] tracking-wide text-text3 uppercase">
              client column — CLIENT_STATUS minus Launched, from the domain, empty columns kept
            </h3>
            <ClientQueueColumnStory />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[11px] tracking-wide text-text3 uppercase">
              ads to launch row — client chip, generated names in mono, the one move the state
              machine allows (launch, pause or resume), disabled with a tooltip
            </h3>
            <AdsToLaunchRowStory />
          </div>
        </div>
      </Section>

      <Section
        title="Team: the roster row and its empty state"
        note="The shapes /app/team introduces. Mounted from the route's own table with plain rows, never re-drawn here: one role chip per role from roleTone, worded Brands fallbacks, Never, and the client row that states its own access."
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[11px] tracking-wide text-text3 uppercase">
              roster — name over email, a chip per role, All brands / No brands, Never, and a client
              row that says its access is the client interface only
            </h3>
            <TeamTableStory />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[11px] tracking-wide text-text3 uppercase">
              empty state — words and the way out, inside the table, never a blank panel
            </h3>
            <TeamEmptyStory />
          </div>
        </div>
      </Section>

      <Section
        title="Interface Config: the switch, the page/field tree and the client preview"
        note="The shapes /app/interface-config introduces. Mounted from the route's own components and wired to one draft, so the toggles work here too: the tree writes through toggleField / togglePage and the preview reads back through enabledPages / visibleFields. Every row is StepRow, every chip is StatusChip, and the switch is role=switch with rounded-input — never a pill."
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[11px] tracking-wide text-text3 uppercase">
              the switch — role=&quot;switch&quot;, aria-checked, rounded-input, labelled by its
              page or field name
            </h3>
            <ConfigToggleStory />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[11px] tracking-wide text-text3 uppercase">
              tree and preview — one page switched off (its field rows mute, their values survive)
              and two concept fields hidden
            </h3>
            <InterfaceConfigStory />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[11px] tracking-wide text-text3 uppercase">
              empty state — every field off is a legitimate configuration, so the preview says so in
              words and offers the way back
            </h3>
            <InterfaceConfigEmptyStory />
          </div>
        </div>
      </Section>

      <Section
        title="Notifications: the routing note and the four-column switch table"
        note="The shapes /app/notifications introduces. Mounted from the route's own NotificationTable, so the story and the page cannot drift. Trigger wording comes from notificationTriggerLabel and the headers from NOTIFICATION_COLUMNS — no §12 string is written here. The Recipient column is text in the mute tone and never a control, which is what the routing note above it explains."
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[11px] tracking-wide text-text3 uppercase">
              the two notes — the Slack DM line, then routingNote() in a rounded-card bg-surface2
              block with the Team link after the sentence
            </h3>
            <NotificationRoutingNoteStory />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[11px] tracking-wide text-text3 uppercase">
              live — two switches per row, each submitting the value the row should become, never a
              flip
            </h3>
            <NotificationTableStory />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[11px] tracking-wide text-text3 uppercase">
              demo mode — every switch disabled through DisabledWrite, and an ON switch still reads
              as on
            </h3>
            <NotificationTableDemoStory />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[11px] tracking-wide text-text3 uppercase">
              empty state — words and the one action that leads somewhere, never a blank panel
            </h3>
            <NotificationsEmptyStory />
          </div>
        </div>
      </Section>

      <Section
        title="Propagation: the admin note, the diff cell and the seven-column decision table"
        note="The shapes /app/propagation introduces. Mounted from the route's own PromotionTable and DiffPreview, so the story and the page cannot drift. The note is PROPAGATION_ADMIN_NOTE from @tas/domain, every chip is StatusChip and every label and tone comes from PROMOTION_STATUS — no status string is written here. The last cell is a DECISION rather than a seventh fact: a status chip, and under it either the two buttons or who settled the request and why."
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[11px] tracking-wide text-text3 uppercase">
              the note — PROPAGATION_ADMIN_NOTE in a rounded-card bg-surface2 block, then how the
              admin check is actually enforced
            </h3>
            <PropagationNoteStory />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[11px] tracking-wide text-text3 uppercase">
              diff preview — previous value struck through in text-text4, requested value in
              text-text2, both font-mono, each truncated to one line
            </h3>
            <DiffPreviewStory />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[11px] tracking-wide text-text3 uppercase">
              the ?status= filter — links rather than buttons, because the state decides which rows
              the server reads
            </h3>
            <PropagationFilterStory />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[11px] tracking-wide text-text3 uppercase">
              live — Approve and Reject on every pending row, and a settled row showing who decided
              it instead of buttons
            </h3>
            <PromotionTableStory />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[11px] tracking-wide text-text3 uppercase">
              demo mode — every control disabled through DisabledWrite with the tooltip that says
              why
            </h3>
            <PromotionTableDemoStory />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[11px] tracking-wide text-text3 uppercase">
              empty state — which state is empty, why a row would appear, and the way out, never a
              blank panel
            </h3>
            <PropagationEmptyStory />
          </div>
        </div>
      </Section>

      <Section
        title="TwoTrackApproval"
        note="Mounted three ways. The gate is isClientTrackOpen; no component computes it locally."
      >
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[11px] tracking-wide text-text3 uppercase">
              internal: ad_submitted
            </h3>
            <TwoTrackApproval track="video" internal="ad_submitted" client="pending_for_approval" />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[11px] tracking-wide text-text3 uppercase">
              internal: approved
            </h3>
            <TwoTrackApproval track="video" internal="approved" client="pending_for_approval" />
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="font-mono text-[11px] tracking-wide text-text3 uppercase">clientOnly</h3>
            <TwoTrackApproval
              track="static"
              internal="static_design_in_progress"
              client="pending_for_approval"
              clientOnly
            />
          </div>
        </div>
      </Section>
    </main>
  );
}
