'use client';

import { COOKIE_NAMES, type SessionView, type SupportedLocale } from '@healthguard/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { api, ApiError } from './api';

export function useSession() {
  return useQuery<SessionView | null>({
    queryKey: ['session'],
    queryFn: async () => {
      try {
        return await api<SessionView>('/auth/me');
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) return null;
        throw error;
      }
    },
    staleTime: 60_000,
  });
}

/** The patient profile the signed-in patient is looking at (their own). */
export function useOwnPatientId(): string | null {
  const { data } = useSession();
  if (!data) return null;
  const inOrg = data.patientProfiles.find(
    (profile) => profile.organization.id === data.activeOrganization?.id,
  );
  return (inOrg ?? data.patientProfiles[0])?.id ?? null;
}

export function useSignOut() {
  const router = useRouter();
  const client = useQueryClient();
  return useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    client.clear();
    router.replace('/login');
  }, [client, router]);
}

export function setLocaleCookie(locale: SupportedLocale): void {
  document.cookie = `${COOKIE_NAMES.locale}=${locale}; path=/; max-age=31536000; samesite=lax`;
}
