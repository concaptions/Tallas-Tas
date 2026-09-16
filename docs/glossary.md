# Glossary — TAS Digital vocabulary → code names

| TAS term | Code name | Meaning |
| --- | --- | --- |
| Creative Hub | platform | The Airtable system being replaced |
| Base (Airtable) | brand | One client's workspace. Rows in `brands` |
| Template base / parent base | template brand | The brand whose rows seed every other brand. `brands.template_brand_id` points at it |
| Child base | child brand | A client brand seeded from the template |
| Agency | agency | TAS Digital itself. One Clerk Organization (D-003) |
| Product / Landing Page | product | `products`: name, link, optional collection link (PRD §5.1) |
| Persona | persona | Research-built customer profile, 14+ long fields (PRD §5.4) |
| Theme | theme | The creative vehicle, the *how*. GLOBAL library, no `brand_id` (PRD §5.5) |
| Angle | angle | Strategist's hypothesis linked to a Persona and Product (PRD §5.6) |
| Batch | batch | Production round B1…B20. First segment of concept and creative names |
| Concept | concept | One Angle paired with one Theme in a Batch. Name = `Batch-Angle-Theme` (PRD §5.7) |
| Creative Sheet / Creative Brief | creative_brief | One record per creative asset. Concept link optional (PRD §5.10, §8) |
| Copy # / Copywriting | copywriting | Ad copy tied to a creative (PRD §5.11) |
| UGC / Creator | creator | Hired content creator, client-approved (PRD §5.8) |
| Partnership Ads | partnership | Whitelisted ads from a creator's handle; sub-fields on creator (PRD §5.8.1) |
| Internal Status | internal_status | Team-only track (PRD §9) |
| Client Status / Approval Status | client_status | Client-facing track (PRD §9) |
| Interface | client interface | Per-brand client-facing pages (PRD §10) |
| Parent interface / child interface | interface template | Interface config is itself templated and propagated |
| Promote | promotion_request | Child edit requesting to land in the template. Admin approves |
| Override | overridden_fields | Fields a child edited locally; propagation skips them |
| CSM | csm | Client Success Manager role |
| Creative Strategist | strategist | Role |
| Media Buyer | media_buyer | Role that downloads, launches and marks Launched |
| Funnel codes | T / R / A | Top of funnel / Retargeting / All funnels (PRD §7) |
| Format codes | V / S / C / M | Video / Static / Carousel / Motion Image (PRD §7) |
| Creative name | creative name formula | `{FUNNEL}{FORMAT}{NUMBER}-BATCH-CONCEPT-VERSION(-PRODUCT)`; number increments per funnel+format within a brand |
| Version | version | V1, V2… picked from a dropdown, written into the name |
| Priority SLA | priority | Static High 12h, Static Average 24h, Video High 24h, Video Average 48h |
| Dimensions | dimensions | Video 4:5 or 1:1 plus 9:16; statics 1:1 and 9:16 (PRD §8) |
| TAS Bot | slack app | Existing Slack app used for DMs. Never create another |
| Pipeline TAS Digital | reference dashboard | https://pipeline.tas-digital.ai, Cloudflare app reading Airtable (PRD §13, §14.7) |
