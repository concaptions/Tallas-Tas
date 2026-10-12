import { BRIEF_NAME_SEPARATOR } from './generate-brief-name';

/**
 * The name a DUPLICATE of a hand-typed or imported brief gets (Oct 12 scope 3). Duplicate copies
 * every field and increments the version; an auto-named row is renamed by the Oct 5 formula with
 * its new number, but a `manual` name is owned by whoever typed it, so the only honest change is
 * its version segment: `TV01-B3-CasualHangouts-V2-GratsiRED` → `…-V3-GratsiRED`. A manual name with
 * no version segment gets one appended, so two rows never share a name by accident.
 */
/*
 * One or two digits: the §7 versions are 1–6, while the Oct 5 formula's head is `V` + a number
 * padded to three digits (`V007`), which is the brief's NUMBER and must never be bumped.
 */
const VERSION_SEGMENT = /(^|-)V(\d{1,2})(?=-|$)/;

export function duplicateManualName(name: string, nextVersion: number): string {
  const trimmed = name.trim();
  if (VERSION_SEGMENT.test(trimmed)) {
    return trimmed.replace(
      VERSION_SEGMENT,
      (_match, lead: string) => `${lead}V${String(nextVersion)}`,
    );
  }
  return `${trimmed}${BRIEF_NAME_SEPARATOR}V${String(nextVersion)}`;
}
