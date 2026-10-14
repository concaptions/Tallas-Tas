import { sectionGuard } from '@/components/shell/section-guard';

/**
 * Closes this section to a role that may not open it (AI-65, PRD §11, Ticket 13). The pool is global
 * but still internal: `canSeeNavSection` lets admins, CSMs, strategists and media buyers in, and keeps
 * video editors, designers, members and clients out. CLAUDE.md non-negotiable 10: clients never see
 * internal data, which the pool is end-to-end.
 */
export default sectionGuard('creator-pool');
