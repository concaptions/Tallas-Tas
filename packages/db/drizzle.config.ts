import { defineConfig } from 'drizzle-kit';

// Schema and output only: `db:generate` needs no database. Migrations are applied by `db:migrate`
// (src/scripts/migrate.ts), which reads `DATABASE_URL` through `@tas/env`; putting credentials here
// would make `db:generate` fail on a machine without them.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './drizzle',
});
