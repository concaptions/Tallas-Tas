# Sprint 7 Notification System — Infrastructure Audit (Agent 1)

Date: 2026-09-23
Auditor: Claude Opus 4.6

## Executive Summary

The spec assumed the notification system needs to be built from scratch. **This is incorrect.** Substantial infrastructure already exists across all three packages. The 8 PRD §12 triggers are consolidated from what Airtable tracks as 23 automations (20 notification, 3 non-notification). The frontend notifications settings page is **already complete** — Agent 3's work is done.

---

## 1. Existing Infrastructure

### Schema (packages/db)

| Component | File | Status |
|---|---|---|
| `notification_settings` table | `schema/notifications.ts` | COMPLETE — brandId, triggerKey, slackEnabled, emailEnabled, position |
| `notification_log` table | `schema/notification-log.ts` | COMPLETE — brandId, triggerKey, channel, recipientUserId, message, deepLink, status (queued/sent/failed), sentAt, errorMessage |
| 8 trigger definitions | `schema/enums.ts` → `notificationTriggers` | COMPLETE — key, label, recipients (BrandRole[]), recipientLabel |
| Channel enum | `schema/enums.ts` → `notificationChannels` | COMPLETE — ['slack', 'email'] |
| Slack ID column on users | `schema/users.ts` → `slackUserId` | COMPLETE |
| Migration 0011 (notification_settings) | `drizzle/0011_*.sql` | APPLIED |
| Migration for notification_log | exists | APPLIED |

### DB Query Layer (packages/db)

| Function | File | Status | Tests |
|---|---|---|---|
| `listNotificationSettings(db, brandId)` | `notifications.ts` | COMPLETE | 7 tests |
| `setChannel(db, brandId, key, channel, enabled, actor)` | `notifications.ts` | COMPLETE | 3 tests |
| `resolveRecipients(db, brandId, roles)` | `notification-dispatch.ts` | COMPLETE | 3 tests |
| `getChannelSettings(db, brandId, key)` | `notification-dispatch.ts` | COMPLETE | 2 tests |
| `logNotification(db, input, actor)` | `notification-dispatch.ts` | COMPLETE | 1 test |
| `markNotificationSent(db, logId)` | `notification-dispatch.ts` | COMPLETE | 1 test |
| `markNotificationFailed(db, logId, error)` | `notification-dispatch.ts` | COMPLETE | 1 test |

### Domain Layer (packages/domain/src/notifications/)

| Module | Exports | Status | Tests |
|---|---|---|---|
| `triggers.ts` | `NOTIFICATION_TRIGGERS`, `NOTIFICATION_TRIGGER_KEYS`, `isNotificationTriggerKey`, `notificationTrigger`, `notificationTriggerLabel` | COMPLETE | 10 tests |
| `channels.ts` | `NOTIFICATION_CHANNELS`, `isNotificationChannel`, `channelLabel` | COMPLETE | 5 tests |
| `routing.ts` | `NOTIFICATION_ROUTING_NOTE`, `NOTIFICATION_ROUTING_LINK_LABEL`, `routingNote` | COMPLETE | 5 tests |
| `dispatch.ts` | `planDeliveries(event, settings, recipients)` → `NotificationDelivery[]` | COMPLETE | 7 tests |

### Frontend (apps/web)

| Component | File | Status |
|---|---|---|
| Notifications settings page | `app/app/notifications/page.tsx` | COMPLETE |
| Notification workspace | `app/app/notifications/notifications-workspace.tsx` | COMPLETE |
| Notification row component | `app/app/notifications/notification-row.tsx` | COMPLETE |
| Server actions (setChannel) | `app/app/notifications/actions.ts` | COMPLETE |
| Field config | `app/app/notifications/fields.ts` | COMPLETE |
| Tests | `actions.test.ts`, `fields.test.ts` | COMPLETE |
| Design system story | `design-system/notifications.stories.tsx` | COMPLETE |

### Environment (packages/env)

| Variable | Status |
|---|---|
| `SLACK_BOT_TOKEN` | Defined (optional) — no credential on this machine |
| `RESEND_API_KEY` | Defined (optional) — no credential on this machine |
| `INNGEST_EVENT_KEY` | Defined (optional) — no credential on this machine |
| `INNGEST_SIGNING_KEY` | Defined (optional) — no credential on this machine |

---

## 2. Airtable Automation Mapping

23 automations found in base `appnaSGAgOUbJ0f9m`. 20 are Slack notifications, 3 are non-notification scripts.

### Mapping: Airtable → PRD §12 Triggers

| PRD §12 Trigger | Airtable Automations | Count |
|---|---|---|
| `brief_assigned` | "Send to Video Editor", "Send to Designer" | 2 |
| `internal_revisions_requested` | "Video Needs Revision", "Ad Submitted for Revision", "Images Needs Revision" | 3 |
| `ad_submitted` | "Ad Submitted" | 1 |
| `client_approved` | "Client Approves Design", "Client Approves Concepts", "Client Approves Meta Copy", "Client Approved the Creator" | 4 |
| `client_requested_revisions` | "Client Comments on Design", "Client comments on Concepts", "Client comments on Meta Copywriting", "Client Revisions / Disapproved" | 4 |
| `creative_ready_to_launch` | "Assets Approved Internally" | 1 |
| `creator_status_changed` | "UGC Request", "UGC Pending for approval", "UGC Creator Approved", "Raw Assets Pending for Approval", "Assets Revisions Needed" | 5 |
| `partnership_expiring` | *(none — scheduled check, not event-driven)* | 0 |

### Non-Notification Automations (not migrated)

| Automation | Type | Note |
|---|---|---|
| "Ad Proofread" | customScript | QA/proofing workflow, not a notification |
| "Ad Proofread V2" | customScript | QA/proofing workflow, not a notification |
| "QA Checklist" | updateRecord | Record initialisation, not a notification |

### Key Insight

All 20 notification automations use `sendToSlack` nodes. This confirms PRD §12: Slack DMs are the primary channel. Email is a per-user toggle (off by default in seed data). The existing 8-trigger model correctly consolidates the 20 automations — no new triggers are needed.

---

## 3. What Does NOT Exist

### 3a. Integration Package (`packages/integrations`)

**Status: Does not exist.** Not even a directory.

Needed:
- **Slack Web API wrapper** — `postDm(slackUserId, message)` using TAS Bot token
- **Resend wrapper** — `sendEmail(to, subject, body)` using Resend API key
- Both behind env-gated feature flags (no-op when credentials absent)
- Package setup: `package.json`, `tsconfig.json`, exports

### 3b. Inngest Job Definitions

**Status: No code exists.** Only env vars defined.

Needed:
- Inngest client initialisation
- `notification/send` function: reads queued logs, calls Slack/Resend, marks sent/failed
- `partnership/check-expiring` cron function: daily check for partnerships expiring within 5 days
- Event type definitions for trigger-specific payloads

### 3c. Dispatch Orchestration

**Status: Building blocks exist, glue does not.**

The pieces:
- `resolveRecipients(db, brandId, roles)` → finds who to notify ✓
- `getChannelSettings(db, brandId, triggerKey)` → checks what's enabled ✓
- `planDeliveries(event, settings, recipients)` → decides what to send ✓
- `logNotification(db, input, actor)` → writes to notification_log ✓

What's missing:
- **`dispatchNotification(db, event, actorId)`** — the orchestrator that:
  1. Looks up the trigger's target roles from `notificationTriggers`
  2. Calls `resolveRecipients` with those roles
  3. Calls `getChannelSettings`
  4. Calls `planDeliveries`
  5. Calls `logNotification` for each delivery
  6. Enqueues an Inngest event for each queued log entry

### 3d. Trigger Hooks in Server Actions

**Status: No server action fires a notification.**

Needed — hook `dispatchNotification` into:
- `updateBrief` when `internalStatus` → 'assigned' (→ `brief_assigned`)
- `updateBrief` when `internalStatus` → 'revisions_needed' (→ `internal_revisions_requested`)
- `updateBrief` when `internalStatus` → 'submitted' (→ `ad_submitted`)
- `approveRecordAction` / client portal (→ `client_approved`)
- `requestRevisionsAction` / client portal (→ `client_requested_revisions`)
- `updateBrief` when `internalStatus` → 'approved' (→ `creative_ready_to_launch`)
- `updateCreator` when status changes (→ `creator_status_changed`)
- Cron job for partnerships (→ `partnership_expiring`)

---

## 4. Revised Agent Scope

### Agent 1 (this audit): COMPLETE

### Agent 2 (wire dispatch): REVISED SCOPE
The spec expected to build schema, 24 triggers, and wire everything. Actual work:
1. Create `packages/integrations` with Slack + Resend wrappers (env-gated no-ops)
2. Create Inngest client + `notification/send` function + `partnership/check-expiring` cron
3. Write `dispatchNotification` orchestrator in `packages/db` or `packages/domain`
4. Hook triggers into existing server actions / domain functions
5. Tests for dispatch orchestrator and integration wrappers

### Agent 3 (frontend preferences UI): ALREADY COMPLETE
The notifications settings page, row components, server actions, field config, design system story, and tests all exist. No work needed unless the design review finds issues.

### Agent 4 (QA): STANDARD
Run typecheck, lint, test, build. Verify the notification log gets written on state transitions. Verify Slack/Resend wrappers are env-gated and no-op without credentials.

---

## 5. Test Coverage Summary

| Area | Test Count | File |
|---|---|---|
| DB notification settings | 7 | `packages/db/src/notifications.test.ts` |
| DB notification dispatch | 8 | `packages/db/src/notification-dispatch.test.ts` |
| Domain triggers | 10 | `packages/domain/src/notifications/triggers.test.ts` |
| Domain channels | 5 | `packages/domain/src/notifications/channels.test.ts` |
| Domain routing | 5 | `packages/domain/src/notifications/routing.test.ts` |
| Domain planDeliveries | 7 | `packages/domain/src/notifications/dispatch.test.ts` |
| Frontend actions | in `actions.test.ts` | `apps/web/src/app/app/notifications/actions.test.ts` |
| Frontend fields | in `fields.test.ts` | `apps/web/src/app/app/notifications/fields.test.ts` |
| **Total existing** | **~44+** | |

---

## Verdict

The notification system is roughly **60% built**. Schema, domain logic, DB query layer, and frontend are complete. The remaining 40% is the integration/delivery layer: Slack/Resend API wrappers, Inngest jobs, the dispatch orchestrator, and trigger hooks in server actions. No schema changes are needed. No new triggers are needed. Agent 3's frontend work is already done.
