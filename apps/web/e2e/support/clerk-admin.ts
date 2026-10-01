/**
 * The Clerk Backend API calls the live specs need for teardown: find and delete the user and the
 * organisation a sign-up test created, so a dev instance does not fill with `tas-e2e-…` accounts.
 * Plain `fetch` against api.clerk.com with the E2E secret key; no SDK, because `@clerk/backend` is
 * not a direct dependency of the app and the four calls are trivial. Every delete is idempotent: a
 * 404 means the record is already gone and counts as done.
 */
const CLERK_API = 'https://api.clerk.com/v1';

interface ClerkUser {
  readonly id: string;
}

interface ClerkOrganizationList {
  readonly data: readonly { readonly id: string; readonly name: string }[];
}

async function clerkRequest(
  secretKey: string,
  method: 'GET' | 'DELETE',
  path: string,
): Promise<Response> {
  const response = await fetch(`${CLERK_API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Clerk API ${method} ${path} failed: ${String(response.status)}`);
  }
  return response;
}

/** The ids of every user holding this email address (normally one or none). */
export async function findClerkUsersByEmail(
  secretKey: string,
  email: string,
): Promise<readonly string[]> {
  const response = await clerkRequest(
    secretKey,
    'GET',
    `/users?email_address=${encodeURIComponent(email)}`,
  );
  if (response.status === 404) {
    return [];
  }
  const users = (await response.json()) as ClerkUser[];
  return users.map((user) => user.id);
}

/** The ids of every organisation whose name is exactly `name`. */
export async function findClerkOrganizationsByName(
  secretKey: string,
  name: string,
): Promise<readonly string[]> {
  const response = await clerkRequest(
    secretKey,
    'GET',
    `/organizations?query=${encodeURIComponent(name)}`,
  );
  if (response.status === 404) {
    return [];
  }
  const list = (await response.json()) as ClerkOrganizationList;
  return list.data.filter((org) => org.name === name).map((org) => org.id);
}

/** Deletes the organisation; already gone is fine. */
export async function deleteClerkOrganization(secretKey: string, id: string): Promise<void> {
  await clerkRequest(secretKey, 'DELETE', `/organizations/${encodeURIComponent(id)}`);
}

/** Deletes the user; already gone is fine. */
export async function deleteClerkUser(secretKey: string, id: string): Promise<void> {
  await clerkRequest(secretKey, 'DELETE', `/users/${encodeURIComponent(id)}`);
}

/**
 * Removes everything a sign-up run created: the organisation first (the user is its only admin),
 * then the user, by the ids the test captured when it has them and by email / name otherwise, so a
 * run that crashed before capturing still cleans up and a second call finds nothing to do.
 */
export async function removeSignUpArtifacts(
  secretKey: string,
  created: {
    readonly email: string;
    readonly organisationName: string;
    readonly userId?: string;
    readonly organizationId?: string;
  },
): Promise<void> {
  const organizationIds = new Set(
    await findClerkOrganizationsByName(secretKey, created.organisationName),
  );
  if (created.organizationId !== undefined) {
    organizationIds.add(created.organizationId);
  }
  for (const id of organizationIds) {
    await deleteClerkOrganization(secretKey, id);
  }
  const userIds = new Set(await findClerkUsersByEmail(secretKey, created.email));
  if (created.userId !== undefined) {
    userIds.add(created.userId);
  }
  for (const id of userIds) {
    await deleteClerkUser(secretKey, id);
  }
}
