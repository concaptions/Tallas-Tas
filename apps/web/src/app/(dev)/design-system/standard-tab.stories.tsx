import { CLIENT_STATUS } from '@tas/domain/state';

const [pending, approved] = CLIENT_STATUS;

import { StandardTab } from '@/app/client/[brandSlug]/(portal)/standard-tab';

/**
 * The client portal's standard tab (Part A2, 2026-10-12): rendered from the brand's RESOLVED
 * columns — the labels and order Interface Config set for the brand — with the client vocabulary
 * in a chip. Here, Gratsi's "Approval" relabel of the template's "Client Approval".
 */
export function StandardTabStory() {
  return (
    <StandardTab
      title="Concepts"
      noun="concept"
      emptyNote="No concepts yet."
      render={{
        columns: [
          { columnKey: 'name', displayLabel: 'Name' },
          { columnKey: 'angle_name', displayLabel: 'Angle' },
          { columnKey: 'client_approval_status', displayLabel: 'Approval' },
        ],
        rows: [
          {
            id: '1',
            name: 'B1-Date night-Romance',
            angle_name: 'Date night',
            client_approval_status: pending.key,
          },
          {
            id: '2',
            name: 'B1-Sleep-Science',
            angle_name: 'Science',
            client_approval_status: approved.key,
          },
          { id: '3', name: 'B2-Gift-Holiday', angle_name: null, client_approval_status: null },
        ],
      }}
    />
  );
}
