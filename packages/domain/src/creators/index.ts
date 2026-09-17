export * from './vocabulary';
export * from './partnership-expiry';
// The three creator status tracks and the partnership activity vocabulary live in
// `../state/creator-status` beside every other status in the platform (CLAUDE.md non-negotiable 2:
// every status label comes from `@tas/domain/state`). Re-exported here so a UGC component can take
// its whole vocabulary — statuses, brackets, platforms, expiry — from one import.
export * from '../state/creator-status';
