# P2E — R2 uploads + multi-attachment schema + image import

**Role**: schema + backend + frontend · **PRD**: §5.8 (UGC assets) · **Est**: L
**Blockers**: `R2_*` credentials are NOT set on the dev machine — uploads verified only with a local substitute; live upload goes under "Pending human verification" in `docs/runbook.md`.

## Current state
`packages/db/src/r2.ts` (SigV4 upload/download) and `apps/web/src/lib/r2-upload.ts`
(re-export) are on `main`. The file-upload dropzone (`f10dc0a`) is on `dev`, NOT on `main`
(excluded from the demo). `creators.profile_pic_url` / `video_intro_url` are single `text`
urls; `ai_characters.attachments` is a single `text`.

## Sub-tickets
### P2E-1 Multi-attachment schema (the one real remaining P1 item)
- [ ] `creators.profile_pic_url` → `profile_pics jsonb` (array of {url,contentType,...}); `video_intro_url` → `video_intros jsonb` — support **multiple image AND video** per creator
- [ ] `ai_characters.attachments` text → jsonb array
- [ ] Migration + backfill existing single urls into 1-element arrays + demo fixtures + domain vocabulary
- [ ] Keep the old text columns until the import/backfill is proven (soft migration), then drop

### P2E-2 Wire R2 uploads end-to-end
- [ ] Bring the dropzone pattern from `dev` (`f10dc0a`) or rebuild; wire to `uploadToR2`
- [ ] Creator profile pics + videos display in Gallery view and on the record
- [ ] Local-substitute test for the upload flow; live R2 under Pending human verification

### P2E-3 Image import investigation
- [ ] Determine why the MCP/Airtable import did not copy image fields (attachment URLs vs. hosted files); fix the importer mapping (coordinate with P2F)

## DoD
Env-driven; unit tests run without R2 creds; acceptance items needing live R2 listed in the runbook.
