import { SignUp } from '@clerk/nextjs';

import { signUpPath } from '@/lib/routes';

export default function SignUpPage() {
  return <SignUp path={signUpPath} />;
}
