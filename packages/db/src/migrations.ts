import { fileURLToPath } from 'node:url';

/** The folder `drizzle-kit generate` writes to (`out` in `drizzle.config.ts`), resolved from here. */
export const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));
