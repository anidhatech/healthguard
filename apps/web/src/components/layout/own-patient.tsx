'use client';

import type { ReactNode } from 'react';
import { LoadingState } from '@/components/ui/states';
import { useOwnPatientId } from '@/lib/session';

/** Renders children with the signed-in patient's own profile ID. */
export function OwnPatient({ children }: { children: (patientId: string) => ReactNode }) {
  const patientId = useOwnPatientId();
  return patientId ? <>{children(patientId)}</> : <LoadingState />;
}
