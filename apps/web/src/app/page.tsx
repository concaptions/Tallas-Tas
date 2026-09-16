import { redirect } from 'next/navigation';

import { appPath } from '@/lib/routes';

/**
 * `/` is the product's front door and the product lives at `/app`. There is no marketing page and
 * no placeholder: a visitor lands in the workspace shell (in demo mode, on fixtures).
 */
export default function RootPage() {
  redirect(appPath);
}
