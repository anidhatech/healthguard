'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { LoadingState } from '@/components/ui/states';
import { useSession } from '@/lib/session';

/** Sends people to their own area, or to sign-in. */
export default function HomePage() {
  const router = useRouter();
  const { data, isLoading } = useSession();
  useEffect(() => {
    if (isLoading) return;
    router.replace(data ? `/${data.homeArea}/dashboard` : '/login');
  }, [data, isLoading, router]);
  return (
    <main id="main" className="p-6">
      <LoadingState />
    </main>
  );
}
