import { sectionGuard } from '@/components/shell/section-guard';

/**
 * Closes this section to a role that may not open it (AI-65, PRD §11). One segment layout covers
 * every route beneath it, detail pages included; the rule itself is `canSeeNavSection` in
 * `@tas/domain`, the same one the sidebar filters with.
 */
export default sectionGuard('email-campaigns');
