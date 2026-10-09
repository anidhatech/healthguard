import { DEMO_ORGANIZATIONS } from '@healthguard/shared';
import type { MemberRole } from '../../src/generated/prisma/client.js';
import type { SeedDb } from './helpers.js';
import { at, calendarAt, seedId } from './scenario.js';

export const ORG = {
  hdmc: seedId('org:hdmc'),
  lakeview: seedId('org:lakeview'),
};

export const USER = {
  ananya: seedId('user:ananya'),
  meera: seedId('user:meera'),
  kavya: seedId('user:kavya'),
  arjun: seedId('user:arjun'),
  ravi: seedId('user:ravi'),
  rahul: seedId('user:rahul'),
  priya: seedId('user:priya'),
  platform: seedId('user:platform'),
  sameer: seedId('user:sameer'),
};

export const MEMBER = {
  meera: seedId('member:meera'),
  kavya: seedId('member:kavya'),
  arjun: seedId('member:arjun'),
  ravi: seedId('member:ravi'),
  sameer: seedId('member:sameer'),
};

export const CLINICIAN = {
  meera: seedId('clinician:meera'),
  arjun: seedId('clinician:arjun'),
  sameer: seedId('clinician:sameer'),
};

export const PATIENT = {
  ananya: seedId('patient:ananya'),
  rahul: seedId('patient:rahul'),
  priya: seedId('patient:priya'),
  kiran: seedId('patient:kiran'),
};

export const ROUTINES = {
  ananya: { wake: '06:30', breakfast: '08:00', lunch: '13:30', dinner: '20:30', sleep: '22:30' },
  rahul: { wake: '06:00', breakfast: '08:30', lunch: '13:00', dinner: '21:00', sleep: '23:00' },
  priya: { wake: '06:45', breakfast: '08:15', lunch: '13:15', dinner: '20:00', sleep: '22:30' },
  kiran: { wake: '07:00', breakfast: '08:30', lunch: '13:30', dinner: '20:30', sleep: '23:00' },
};

export async function seedPeople(db: SeedDb, passwordHash: string): Promise<void> {
  await db.organization.createMany({
    data: [
      {
        id: ORG.hdmc,
        slug: DEMO_ORGANIZATIONS.medicalCenter.slug,
        name: DEMO_ORGANIZATIONS.medicalCenter.name,
        type: 'CLINIC',
        isDemo: true,
        settings: { enabledLocales: ['en-IN', 'hi-IN', 'te-IN'] },
        createdAt: at(-400, '09:00'),
      },
      {
        id: ORG.lakeview,
        slug: DEMO_ORGANIZATIONS.lakeview.slug,
        name: DEMO_ORGANIZATIONS.lakeview.name,
        type: 'HOSPITAL',
        isDemo: true,
        settings: { enabledLocales: ['en-IN', 'hi-IN'] },
        createdAt: at(-300, '09:00'),
      },
    ],
  });

  const user = (
    id: string,
    email: string,
    displayName: string,
    locale = 'en-IN',
    platformRole: 'NONE' | 'PLATFORM_ADMIN' = 'NONE',
  ) => ({
    id,
    email,
    displayName,
    preferredLocale: locale,
    status: 'ACTIVE' as const,
    platformRole,
    passwordHash,
    createdAt: at(-400, '09:00'),
  });
  await db.user.createMany({
    data: [
      user(USER.ananya, 'patient@healthguard.demo', 'Ananya Rao', 'te-IN'),
      user(USER.meera, 'doctor@healthguard.demo', 'Dr. Meera Sharma'),
      user(USER.kavya, 'admin@healthguard.demo', 'Kavya Iyer'),
      user(USER.arjun, 'arjun.reddy@healthguard.demo', 'Dr. Arjun Reddy'),
      user(USER.ravi, 'care@healthguard.demo', 'Ravi Kumar', 'hi-IN'),
      user(USER.rahul, 'rahul.mehta@healthguard.demo', 'Rahul Mehta', 'hi-IN'),
      user(USER.priya, 'priya.nair@healthguard.demo', 'Priya Nair'),
      user(USER.platform, 'platform@healthguard.demo', 'Platform Admin', 'en-IN', 'PLATFORM_ADMIN'),
      user(USER.sameer, 'lakeview.doctor@healthguard.demo', 'Dr. Sameer Khan'),
    ],
  });

  const member = (id: string, organizationId: string, userId: string, roles: MemberRole[]) => ({
    id,
    organizationId,
    userId,
    roles,
    status: 'ACTIVE' as const,
    joinedAt: at(-390, '09:00'),
  });
  await db.organizationMember.createMany({
    data: [
      member(MEMBER.meera, ORG.hdmc, USER.meera, ['DOCTOR']),
      member(MEMBER.kavya, ORG.hdmc, USER.kavya, ['ORG_ADMIN']),
      member(MEMBER.arjun, ORG.hdmc, USER.arjun, ['DOCTOR']),
      member(MEMBER.ravi, ORG.hdmc, USER.ravi, ['CARE_COORDINATOR']),
      member(MEMBER.sameer, ORG.lakeview, USER.sameer, ['DOCTOR']),
    ],
  });

  await db.clinicianProfile.createMany({
    data: [
      {
        id: CLINICIAN.meera,
        organizationId: ORG.hdmc,
        memberId: MEMBER.meera,
        displayName: 'Dr. Meera Sharma',
        specialty: 'Internal medicine',
        qualifications: 'MBBS, MD (synthetic)',
        isPrescriber: true,
      },
      {
        id: CLINICIAN.arjun,
        organizationId: ORG.hdmc,
        memberId: MEMBER.arjun,
        displayName: 'Dr. Arjun Reddy',
        specialty: 'Cardiology',
        qualifications: 'MBBS, DM (synthetic)',
        isPrescriber: true,
      },
      {
        id: CLINICIAN.sameer,
        organizationId: ORG.lakeview,
        memberId: MEMBER.sameer,
        displayName: 'Dr. Sameer Khan',
        specialty: 'Family medicine',
        qualifications: 'MBBS (synthetic)',
        isPrescriber: true,
      },
    ],
  });

  const patient = (args: {
    id: string;
    organizationId: string;
    userId: string | null;
    mrn: string;
    givenName: string;
    familyName: string;
    dob: string;
    sex: 'FEMALE' | 'MALE';
    phone: string;
    locale: string;
    routine: Record<string, string>;
    primaryClinicianId: string;
  }) => ({
    id: args.id,
    organizationId: args.organizationId,
    userId: args.userId,
    mrn: args.mrn,
    givenName: args.givenName,
    familyName: args.familyName,
    dateOfBirth: calendarAt(args.dob),
    sex: args.sex,
    phone: args.phone,
    preferredLocale: args.locale,
    dailyRoutine: args.routine,
    primaryClinicianId: args.primaryClinicianId,
    isSynthetic: true,
    createdAt: at(-380, '09:00'),
  });
  await db.patientProfile.createMany({
    data: [
      patient({
        id: PATIENT.ananya,
        organizationId: ORG.hdmc,
        userId: USER.ananya,
        mrn: 'HDMC-000101',
        givenName: 'Ananya',
        familyName: 'Rao',
        dob: '1968-03-14',
        sex: 'FEMALE',
        phone: '+910000000101',
        locale: 'te-IN',
        routine: ROUTINES.ananya,
        primaryClinicianId: CLINICIAN.meera,
      }),
      patient({
        id: PATIENT.rahul,
        organizationId: ORG.hdmc,
        userId: USER.rahul,
        mrn: 'HDMC-000102',
        givenName: 'Rahul',
        familyName: 'Mehta',
        dob: '1961-11-02',
        sex: 'MALE',
        phone: '+910000000102',
        locale: 'hi-IN',
        routine: ROUTINES.rahul,
        primaryClinicianId: CLINICIAN.arjun,
      }),
      patient({
        id: PATIENT.priya,
        organizationId: ORG.hdmc,
        userId: USER.priya,
        mrn: 'HDMC-000103',
        givenName: 'Priya',
        familyName: 'Nair',
        dob: '1990-07-21',
        sex: 'FEMALE',
        phone: '+910000000103',
        locale: 'en-IN',
        routine: ROUTINES.priya,
        primaryClinicianId: CLINICIAN.meera,
      }),
      patient({
        id: PATIENT.kiran,
        organizationId: ORG.lakeview,
        userId: null,
        mrn: 'LDH-000201',
        givenName: 'Kiran',
        familyName: 'Joshi',
        dob: '1975-01-30',
        sex: 'MALE',
        phone: '+910000000201',
        locale: 'hi-IN',
        routine: ROUTINES.kiran,
        primaryClinicianId: CLINICIAN.sameer,
      }),
    ],
  });
}
