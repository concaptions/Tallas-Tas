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
 */
export {
  ArrowRight,
  Book,
  CalendarRange,
  Captions,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleX,
  Clock,
  Copy,
  File,
  Grid3x3,
  GripVertical,
  House,
  Image,
  Info,
  Layers2,
  LayoutGrid,
  Link,
  Lock,
  LockOpen,
  Minus,
  MousePointer2,
  Pin,
  PinOff,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Rows3,
  Search,
  SquareKanban,
  Star,
  Table,
  TextAlignStart,
  Trash,
  TriangleAlert,
  X,
} from 'lucide-react';

export type { LucideIcon, LucideProps } from 'lucide-react';
