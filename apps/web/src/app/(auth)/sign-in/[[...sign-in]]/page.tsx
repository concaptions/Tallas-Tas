import { SignIn } from '@clerk/nextjs';

import { signInPath } from '@/lib/routes';

export default function SignInPage() {
  return <SignIn path={signInPath} />;
}
