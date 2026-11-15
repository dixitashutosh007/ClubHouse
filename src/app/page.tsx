import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/lib/auth/cookie-names';
import { ClubHouseHome } from './_components/ClubHouseHome';

/**
 * Home. Without a session cookie nobody can be signed in, so the sign-in
 * screen is rendered into the first HTML instead of waiting for the
 * browser's session check (which would show a loading screen first).
 */
export default function HomePage() {
  return (
    <Suspense fallback={<ClubHouseHome view="hub" />}>
      <HomeForVisitor />
    </Suspense>
  );
}

async function HomeForVisitor() {
  const hasSession = (await cookies()).has(SESSION_COOKIE);
  return <ClubHouseHome view="hub" signedOut={!hasSession} />;
}
