/**
 * Roles.
 *
 * Staff hold one or more organization roles through their membership.
 * `PATIENT` is a subject scope (the user's own patient profiles) and
 * `PLATFORM_ADMIN` is a platform role. `CARE_TEAM` is a role group: the design
 * keeps nurses and care coordinators as separate roles because they may see
 * different data, and `CARE_TEAM` lets guards address both at once.
 */
export const MEMBER_ROLES = [
  'ORG_ADMIN',
  'DOCTOR',
  'NURSE',
  'CARE_COORDINATOR',
  'FRONT_DESK',
  'AUDITOR',
] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export const PATIENT_ROLE = 'PATIENT' as const;
export const PLATFORM_ADMIN_ROLE = 'PLATFORM_ADMIN' as const;

export type SessionRole = MemberRole | typeof PATIENT_ROLE | typeof PLATFORM_ADMIN_ROLE;

export const ROLE_GROUPS = {
  CARE_TEAM: ['NURSE', 'CARE_COORDINATOR'],
} as const satisfies Record<string, readonly MemberRole[]>;
export type RoleGroup = keyof typeof ROLE_GROUPS;

/** Anything a route may require: a concrete role or a role group. */
export type RoleRequirement = SessionRole | RoleGroup;

export const ALL_ROLE_REQUIREMENTS: readonly RoleRequirement[] = [
  ...MEMBER_ROLES,
  PATIENT_ROLE,
  PLATFORM_ADMIN_ROLE,
  'CARE_TEAM',
];

export function isMemberRole(value: unknown): value is MemberRole {
  return typeof value === 'string' && (MEMBER_ROLES as readonly string[]).includes(value);
}

/** Expands a requirement into the concrete roles that satisfy it. */
export function expandRoleRequirement(requirement: RoleRequirement): readonly SessionRole[] {
  if (requirement === 'CARE_TEAM') return ROLE_GROUPS.CARE_TEAM;
  return [requirement];
}

/** True when the session holds at least one role that satisfies any requirement. */
export function satisfiesAnyRole(
  sessionRoles: readonly SessionRole[],
  requirements: readonly RoleRequirement[],
): boolean {
  return requirements.some((requirement) =>
    expandRoleRequirement(requirement).some((role) => sessionRoles.includes(role)),
  );
}

/** The landing area of the web app for a set of roles, most specific first. */
export function homeAreaForRoles(roles: readonly SessionRole[]): 'patient' | 'doctor' | 'admin' {
  if (roles.includes('DOCTOR') || roles.includes('NURSE') || roles.includes('CARE_COORDINATOR')) {
    return 'doctor';
  }
  if (
    roles.includes('ORG_ADMIN') ||
    roles.includes('PLATFORM_ADMIN') ||
    roles.includes('AUDITOR')
  ) {
    return 'admin';
  }
  if (roles.includes('FRONT_DESK')) return 'doctor';
  return 'patient';
}

export const ROLE_LABELS: Record<RoleRequirement, string> = {
  ORG_ADMIN: 'Organization admin',
  DOCTOR: 'Doctor',
  NURSE: 'Nurse',
  CARE_COORDINATOR: 'Care coordinator',
  FRONT_DESK: 'Front desk',
  AUDITOR: 'Auditor',
  PATIENT: 'Patient',
  PLATFORM_ADMIN: 'Platform admin',
  CARE_TEAM: 'Care team',
};
