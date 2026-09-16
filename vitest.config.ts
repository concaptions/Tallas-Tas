import { existsSync, readdirSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// Vitest refuses a `projects` glob that matches nothing, so a workspace root is listed only once it
// holds at least one package. The empty tree runs as a single project with no tests.
const hasPackages = (dir: string): boolean =>
  existsSync(dir) && readdirSync(dir, { withFileTypes: true }).some((entry) => entry.isDirectory());

const projects = ['packages', 'apps'].filter(hasPackages).map((dir) => `${dir}/*`);

export default defineConfig({
  test: {
    passWithNoTests: true,
    ...(projects.length > 0 ? { projects } : {}),
  },
});
