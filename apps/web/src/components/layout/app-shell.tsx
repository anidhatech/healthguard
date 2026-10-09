'use client';

import { DEMO_AUTH_NOTICE, satisfiesAnyRole, type RoleRequirement } from '@healthguard/shared';
import {
  Activity,
  Bell,
  Building2,
  CalendarDays,
  FileHeart,
  FlaskConical,
  History,
  Home,
  LogOut,
  Menu,
  Pill,
  ShieldCheck,
  Stethoscope,
  User,
  type LucideIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/ui/states';
import { useSession, useSignOut } from '@/lib/session';
import { cn } from '@/lib/utils';
import { LanguageSwitcher } from './language-switcher';

type Area = 'patient' | 'doctor' | 'admin';

const NAV: Record<Area, { href: string; key: string; icon: LucideIcon }[]> = {
  patient: [
    { href: '/patient/dashboard', key: 'dashboard', icon: Home },
    { href: '/patient/medications', key: 'medications', icon: Pill },
    { href: '/patient/timeline', key: 'timeline', icon: History },
    { href: '/patient/tests', key: 'tests', icon: FlaskConical },
    { href: '/patient/records', key: 'records', icon: FileHeart },
    { href: '/patient/activity', key: 'activity', icon: Activity },
    { href: '/patient/appointments', key: 'appointments', icon: CalendarDays },
    { href: '/patient/consent', key: 'consent', icon: ShieldCheck },
    { href: '/patient/notifications', key: 'notifications', icon: Bell },
    { href: '/patient/profile', key: 'profile', icon: User },
  ],
  doctor: [{ href: '/doctor/dashboard', key: 'patients', icon: Stethoscope }],
  admin: [{ href: '/admin/dashboard', key: 'admin', icon: Building2 }],
};

const AREA_ROLES: Record<Area, RoleRequirement[]> = {
  patient: ['PATIENT'],
  doctor: ['DOCTOR', 'CARE_TEAM', 'FRONT_DESK'],
  admin: ['ORG_ADMIN', 'AUDITOR', 'PLATFORM_ADMIN'],
};

/**
 * Layout for a signed-in area, with role-based routing: someone in the wrong
 * area is sent to their own. (The API enforces access on every request; this
 * only keeps navigation sensible.)
 */
export function AppShell({ area, children }: { area: Area; children: ReactNode }) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const router = useRouter();
  const signOut = useSignOut();
  const { data: session, isLoading } = useSession();
  const [open, setOpen] = useState(false);
  const allowed = session ? satisfiesAnyRole(session.roles, AREA_ROLES[area]) : false;

  useEffect(() => {
    if (isLoading) return;
    if (!session) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (!allowed) router.replace(`/${session.homeArea}/dashboard`);
  }, [allowed, isLoading, pathname, router, session]);

  if (isLoading || !session || !allowed)
    return (
      <div className="p-6">
        <LoadingState />
      </div>
    );

  const links = NAV[area];
  return (
    <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-6xl flex-col md:flex-row">
      <aside className="border-b border-line bg-white md:w-60 md:shrink-0 md:border-r md:border-b-0">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <Link
            href={`/${area}/dashboard`}
            className="flex items-center gap-2 font-semibold text-brand-700"
          >
            <ShieldCheck aria-hidden className="size-5" /> HealthGuard
          </Link>
          <button
            type="button"
            className="inline-flex min-h-10 items-center gap-1 rounded-md px-2 text-sm md:hidden"
            aria-expanded={open}
            aria-controls="main-nav"
            onClick={() => setOpen((value) => !value)}
          >
            <Menu aria-hidden className="size-5" /> {t('menu')}
          </button>
        </div>
        <nav
          id="main-nav"
          aria-label="Main"
          className={cn('px-2 pb-3 md:block', open ? 'block' : 'hidden')}
        >
          <ul className="flex flex-col gap-0.5">
            {links.map(({ href, key, icon: Icon }) => {
              const active =
                pathname === href ||
                pathname.startsWith(`${href}/`) ||
                (key === 'patients' && pathname.startsWith('/doctor'));
              return (
                <li key={href}>
                  <Link
                    href={href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex min-h-10 items-center gap-2 rounded-md px-3 text-sm',
                      active
                        ? 'bg-brand-50 font-medium text-brand-700'
                        : 'text-ink hover:bg-surface',
                    )}
                  >
                    <Icon aria-hidden className="size-4" /> {t(key)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-white px-4 py-2">
          <div className="min-w-0 text-sm">
            <p className="truncate font-medium">{session.user.displayName}</p>
            <p className="truncate text-xs text-muted">
              {session.activeOrganization?.name ?? 'HealthGuard platform'} ·{' '}
              {session.roles.join(', ')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {session.authMethod === 'DEMO_QUICK_LOGIN' ? (
              <Badge tone="warn" title={DEMO_AUTH_NOTICE}>
                DEMO SIGN-IN
              </Badge>
            ) : null}
            <LanguageSwitcher />
            <Button variant="ghost" size="sm" onClick={() => void signOut()}>
              <LogOut aria-hidden className="size-4" />{' '}
              <span className="hidden sm:inline">{t('signOut')}</span>
            </Button>
          </div>
        </header>
        <main id="main" className="flex-1 px-4 py-5 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}
