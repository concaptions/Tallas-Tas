import { z } from 'zod';

/** Raw key/value pairs, the shape of `process.env` and of a parsed `.env` file. */
export type EnvSource = Readonly<Record<string, string | undefined>>;

const secret = z.string().min(1);

/** Variables safe for the browser. Next.js inlines `NEXT_PUBLIC_*` at build time. */
export const clientSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Clerk publishable keys start with `pk_`; the prefix check keeps a secret key (`sk_`) out of the browser bundle.
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().startsWith('pk_').optional(),
});

/** Every variable the server may read. Optional entries are validated only when present. */
export const serverSchema = clientSchema.extend({
  DATABASE_URL: z.url().optional(),
  CLERK_SECRET_KEY: z.string().startsWith('sk_').optional(),
  SLACK_BOT_TOKEN: secret.optional(),
  RESEND_API_KEY: secret.optional(),
  INNGEST_EVENT_KEY: secret.optional(),
  INNGEST_SIGNING_KEY: secret.optional(),
  R2_ACCOUNT_ID: secret.optional(),
  R2_ACCESS_KEY_ID: secret.optional(),
  R2_SECRET_ACCESS_KEY: secret.optional(),
  R2_BUCKET: secret.optional(),
  ANTHROPIC_API_KEY: secret.optional(),
  AIRTABLE_PAT: secret.optional(),
  // JSON array of `{ baseId, creatorsTableId, brandLabel }` naming the OTHER client bases the
  // creator-registry scripts may read (Oct 8 Talal ask). Parsed and validated by
  // `parseAirtableSourceBases` in @tas/db; kept as a string here so a bad entry fails at the script
  // with a message naming the entry, not at every server boot.
  AIRTABLE_SOURCE_BASES: secret.optional(),
  META_ACCESS_TOKEN: secret.optional(),
  META_AD_ACCOUNT_ID: secret.optional(),
  // Playwright live mode (docs/runbook.md, "Playwright live mode"): one variable per GitHub secret,
  // exported under the same names locally. The `_TEST` / `_E2E` suffixes keep a developer's own
  // Clerk keys and DATABASE_URL out of the E2E run, and the run out of their database.
  CLERK_PUBLISHABLE_KEY_TEST: z.string().startsWith('pk_').optional(),
  CLERK_SECRET_KEY_TEST: z.string().startsWith('sk_').optional(),
  CLERK_E2E_USER_PASSWORD: secret.optional(),
  DATABASE_URL_E2E: z.url().optional(),
  // Not a secret: the pre-created test user's address. apps/web/src/lib/live-e2e-env.ts has the default.
  CLERK_E2E_USER_EMAIL: z.email().optional(),
});

export type ClientEnv = z.output<typeof clientSchema>;
export type ServerEnv = z.output<typeof serverSchema>;

/** An `.env.local` copied from `.env.example` holds `KEY=` lines; an empty value means "not set". */
function withoutEmpty(source: EnvSource): EnvSource {
  return Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value !== ''),
  );
}

/** Validates `source` against `schema`; the error lists every failing variable by name. */
export function parseEnv<Schema extends z.ZodType>(
  schema: Schema,
  source: EnvSource,
): z.output<Schema> {
  const result = schema.safeParse(withoutEmpty(source));
  if (result.success) {
    return result.data;
  }
  const lines = result.error.issues.map(
    (issue) => `  ${issue.path.map(String).join('.')}: ${issue.message}`,
  );
  throw new Error(`Invalid environment variables:\n${lines.join('\n')}`);
}
