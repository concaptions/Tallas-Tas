/**
 * Day arithmetic for the Airtable `DATEADD(..., n, 'days')` formulas, in UTC.
 *
 * UTC on purpose: every timestamp in this schema is `timestamptz` and the grids render ISO dates, so
 * a local-time shift would move a due date across a day boundary for half the world.
 */
function addDays(from: Date, days: number): Date {
  const result = new Date(from.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/** `null` in, `null` out: an unset send date has no derivable due date, and we never invent one. */
function offsetOrNull(from: Date | null | undefined, days: number): Date | null {
  if (from === null || from === undefined) return null;
  if (Number.isNaN(from.getTime())) return null;
  return addDays(from, days);
}

/**
 * Email Campaigns Management › `Design Due Date`.
 * Airtable: `DATEADD({Send Date}, -5, 'days')`.
 */
export function emailCampaignDesignDueDate(sendDate: Date | null | undefined): Date | null {
  return offsetOrNull(sendDate, -5);
}

/**
 * Email Campaigns Management › `Copywriting Due Date`.
 * Airtable: `DATEADD({Design Due Date}, -5, 'days')` — and Design Due Date is itself `Send Date − 5`,
 * so this is TEN days before the send date, not five. The chain is the whole reason this lives in one
 * place: read either offset alone and the copy deadline is wrong by a working week.
 */
export function emailCampaignCopywritingDueDate(sendDate: Date | null | undefined): Date | null {
  return offsetOrNull(emailCampaignDesignDueDate(sendDate), -5);
}

/**
 * Email Flows Management › `Design Due Date`.
 * Airtable: `DATEADD({Expected Setup Date}, -5, 'days')`.
 */
export function emailFlowDesignDueDate(expectedSetupDate: Date | null | undefined): Date | null {
  return offsetOrNull(expectedSetupDate, -5);
}

/**
 * Email Flows Management › `Copywriting Due Date`.
 * Airtable: `DATEADD({Design Due Date}, -5, 'days')`, chained exactly as the campaign one is.
 */
export function emailFlowCopywritingDueDate(
  expectedSetupDate: Date | null | undefined,
): Date | null {
  return offsetOrNull(emailFlowDesignDueDate(expectedSetupDate), -5);
}

/**
 * SM Campaign Management Feed › `Reminder Trigger`.
 * Airtable: `IF(IS_AFTER(NOW(), DATEADD({Due Date}, -12, 'hours')), "Yes", "No")`.
 *
 * `now` is a PARAMETER, never `new Date()` inside: this value depends on wall-clock time, so it is
 * computed at read time and never stored, and a test has to be able to pin the clock.
 */
export function smReminderTrigger(dueDate: Date | null | undefined, now: Date): 'Yes' | 'No' {
  if (dueDate === null || dueDate === undefined || Number.isNaN(dueDate.getTime())) return 'No';
  const threshold = new Date(dueDate.getTime() - 12 * 60 * 60 * 1000);
  return now.getTime() > threshold.getTime() ? 'Yes' : 'No';
}

/**
 * UGC Management › `Notify Flag`.
 * Airtable: `IF(AND({Date of Partnership Activation}, DATETIME_DIFF(TODAY(), {…}, 'days') >= 25), "YES")`
 * — an IF with no false branch, so a row that does not qualify reads blank, which is `null` here.
 * Clock-dependent, so read time only.
 */
export function creatorNotifyFlag(
  partnershipActivatedAt: Date | null | undefined,
  now: Date,
): 'YES' | null {
  if (
    partnershipActivatedAt === null ||
    partnershipActivatedAt === undefined ||
    Number.isNaN(partnershipActivatedAt.getTime())
  ) {
    return null;
  }
  const days = Math.floor(
    (now.getTime() - partnershipActivatedAt.getTime()) / (24 * 60 * 60 * 1000),
  );
  return days >= 25 ? 'YES' : null;
}
