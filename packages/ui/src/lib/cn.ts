import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Moved here from apps/web/src/lib/utils.ts: every package that renders class names shares one. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
