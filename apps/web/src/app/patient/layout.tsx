import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';

export default function PatientLayout({ children }: { children: ReactNode }) {
  return <AppShell area="patient">{children}</AppShell>;
}
