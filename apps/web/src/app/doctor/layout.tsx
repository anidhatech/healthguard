import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';

export default function DoctorLayout({ children }: { children: ReactNode }) {
  return <AppShell area="doctor">{children}</AppShell>;
}
