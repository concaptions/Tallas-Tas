/**
 * The product's icon set (Oct 12 UI overhaul, `docs/sprint-oct12-ui-gap.md` "Icon map", ruling 5).
 *
 * `lucide-react` is a dependency of `@tas/ui` alone; pnpm is strict, so `apps/web` has no import
 * path of its own. This module is the gateway: it is exposed as the `@tas/ui/icons` subpath so a
 * surface imports `{ Check } from '@tas/ui/icons'`, and it re-exports ONLY the canonical names —
 * `Trash2`, `Unlock`, `XCircle`, `AlertTriangle`, `Home` and `AlignLeft` exist in 1.46 only as
 * aliases, `Text` not at all, and `Grid3X3` is spelled `Grid3x3`. A subpath rather than the main
 * barrel because `Table`, `Link`, `Image`, `File` would collide with the component exports, and
 * because a single file makes the set auditable: an icon the boards never drew is not here.
 *
 * The additions from `Bell` through `Video` are the Bold shell's nav and top-bar set (redesign
 * commits 2/2b, docs/design/bold-redesign-spec.md §3 "Iconography": lucide at 18px, stroke 1.75,
 * mapped per nav section in `apps/web/src/components/shell/bold/bold-sidebar.tsx`).
 */
export {
  ArrowRight,
  Bell,
  Book,
  Bot,
  Box,
  Building2,
  CalendarRange,
  Captions,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleX,
  ClipboardList,
  Clock,
  Copy,
  Eye,
  File,
  Folder,
  GitMerge,
  Grid3x3,
  GripVertical,
  House,
  Image,
  Info,
  Layers2,
  LayoutGrid,
  Lightbulb,
  Link,
  Lock,
  LockOpen,
  Megaphone,
  Menu,
  Minus,
  Monitor,
  MousePointer2,
  Palette,
  PenLine,
  Pin,
  PinOff,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Rows3,
  Ruler,
  Search,
  SquareKanban,
  Star,
  Table,
  Target,
  TextAlignStart,
  Trash,
  TrendingUp,
  TriangleAlert,
  Trophy,
  Users,
  Video,
  X,
} from 'lucide-react';

export type { LucideIcon, LucideProps } from 'lucide-react';
