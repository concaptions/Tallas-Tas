'use server';

import {
  approveCreativeAction as _approve,
  requestRevisionsAction as _revisions,
  type ClientQueueActionResult,
} from '@/app/app/queue/client/actions';

export async function approveCreativeAction(
  previous: ClientQueueActionResult | null,
  formData: FormData,
): Promise<ClientQueueActionResult> {
  return _approve(previous, formData);
}

export async function requestRevisionsAction(
  previous: ClientQueueActionResult | null,
  formData: FormData,
): Promise<ClientQueueActionResult> {
  return _revisions(previous, formData);
}
