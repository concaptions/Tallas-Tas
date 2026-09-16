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
