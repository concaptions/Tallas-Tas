# Ticket 12 empty-state copy — Talal review

Oct 14 follow-up #6 (`docs/sprint-oct12.md`): the seven strings in
`apps/web/src/app/app/creative-sheet/stats-copy.ts` carry a `// Talal review` tag each. This
table collects them for the Oct 16 Thursday sync so Talal can read them beside the slot they
render in and the KPI tile or chart panel they empty out. The "Proposed alternative" column is
left blank for every row — Talal picks.

The slot column is the `data-slot` or `slot` prop the stats tab passes to the KPI tile or
`StatsPanel`, verified against `apps/web/src/app/app/creative-sheet/stats-tab.tsx`.

| String key | Where it appears | Current wording | Proposed alternative (optional) |
| --- | --- | --- | --- |
| `EMPTY_IN_FLIGHT` | KPI tile `brief-stats-in-flight` ("Briefs in flight") | No briefs in flight yet. |  |
| `EMPTY_APPROVED_WEEK` | KPI tile `brief-stats-approved-week` ("Approved this week") | No approvals this week. |  |
| `EMPTY_REVISIONS` | KPI tile `brief-stats-avg-revision` ("Avg revision turnaround") | No revisions to measure. |  |
| `EMPTY_SUBMISSIONS_WINDOW` | KPI tile `brief-stats-qa-pass-rate` ("QA pass rate (30d)") | No briefs reached submission in the last 30 days. |  |
| `EMPTY_PER_EDITOR` | Chart panel `brief-stats-per-editor` ("In the works") | No editor has an assigned brief yet. |  |
| `EMPTY_WEEKLY_OUTPUT` | Chart panel `brief-stats-weekly` ("Weekly output") | No submissions uploaded this week. |  |
| `EMPTY_TURNAROUND` | Chart panel `brief-stats-turnaround` ("Revision turnaround (30d)") | No revision rounds in the last 30 days. |  |
