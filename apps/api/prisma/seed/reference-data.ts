import type {
  AccessAction,
  DataCategory,
  DoseForm,
  MemberRole,
  Route,
} from '../../src/generated/prisma/client.js';
import { seedId } from './scenario.js';

/** Real generic medicines, used in a synthetic scenario. Not prescriptions. */
export const MEDICATIONS = {
  metformin500: {
    genericName: 'Metformin',
    strengthValue: 500,
    strengthUnit: 'mg',
    form: 'TABLET',
    defaultRoute: 'ORAL',
    atcCode: 'A10BA02',
    allergenClasses: [] as string[],
  },
  telmisartan40: {
    genericName: 'Telmisartan',
    strengthValue: 40,
    strengthUnit: 'mg',
    form: 'TABLET',
    defaultRoute: 'ORAL',
    atcCode: 'C09CA07',
    allergenClasses: [] as string[],
  },
  amlodipine5: {
    genericName: 'Amlodipine',
    strengthValue: 5,
    strengthUnit: 'mg',
    form: 'TABLET',
    defaultRoute: 'ORAL',
    atcCode: 'C08CA01',
    allergenClasses: [] as string[],
  },
  levothyroxine50: {
    genericName: 'Levothyroxine',
    strengthValue: 50,
    strengthUnit: 'mcg',
    form: 'TABLET',
    defaultRoute: 'ORAL',
    atcCode: 'H03AA01',
    allergenClasses: [] as string[],
  },
  atorvastatin10: {
    genericName: 'Atorvastatin',
    strengthValue: 10,
    strengthUnit: 'mg',
    form: 'TABLET',
    defaultRoute: 'ORAL',
    atcCode: 'C10AA05',
    allergenClasses: [] as string[],
  },
  amoxicillin500: {
    genericName: 'Amoxicillin',
    strengthValue: 500,
    strengthUnit: 'mg',
    form: 'CAPSULE',
    defaultRoute: 'ORAL',
    atcCode: 'J01CA04',
    allergenClasses: ['PENICILLIN'],
  },
  paracetamol500: {
    genericName: 'Paracetamol',
    strengthValue: 500,
    strengthUnit: 'mg',
    form: 'TABLET',
    defaultRoute: 'ORAL',
    atcCode: 'N02BE01',
    allergenClasses: [] as string[],
  },
} satisfies Record<
  string,
  {
    genericName: string;
    strengthValue: number;
    strengthUnit: string;
    form: DoseForm;
    defaultRoute: Route;
    atcCode: string;
    allergenClasses: string[];
  }
>;
export type MedicationKey = keyof typeof MEDICATIONS;
export const medicationId = (key: MedicationKey): string => seedId(`medication:${key}`);

export const LAB_TESTS = {
  HBA1C: {
    name: 'HbA1c',
    loincCode: '4548-4',
    unit: '%',
    referenceLow: 4.0,
    referenceHigh: 5.6,
    category: 'Diabetes',
  },
  FASTING_GLUCOSE: {
    name: 'Fasting plasma glucose',
    loincCode: '1558-6',
    unit: 'mg/dL',
    referenceLow: 70,
    referenceHigh: 99,
    category: 'Diabetes',
  },
  CREATININE: {
    name: 'Serum creatinine',
    loincCode: '2160-0',
    unit: 'mg/dL',
    referenceLow: 0.5,
    referenceHigh: 1.1,
    category: 'Kidney function',
  },
  TSH: {
    name: 'Thyroid-stimulating hormone',
    loincCode: '3016-3',
    unit: 'mIU/L',
    referenceLow: 0.4,
    referenceHigh: 4.0,
    category: 'Thyroid',
  },
} as const;
export type LabTestCode = keyof typeof LAB_TESTS;
export const labTestId = (code: LabTestCode): string => seedId(`lab-test:${code}`);

const CLINICAL: DataCategory[] = [
  'ENCOUNTERS',
  'CONDITIONS',
  'ALLERGIES',
  'HISTORY',
  'MEDICATIONS',
  'ADHERENCE',
  'LABS',
  'VITALS',
  'ACTIVITY',
  'DOCUMENTS',
  'CARE_PLAN',
  'APPOINTMENTS',
];

export const CONSENT_PURPOSES = [
  {
    code: 'CONSULTATION',
    name: 'Consultation and care',
    description: 'Clinicians treating you can see your record to provide care.',
    defaultCategories: ['DEMOGRAPHICS', ...CLINICAL],
    defaultDurationDays: 365,
    abdmPurposeCode: 'CAREMGT',
    isActive: true,
  },
  {
    code: 'MEDICATION_MANAGEMENT',
    name: 'Medication reminders and adherence',
    description: 'Your care team can see your medicines and whether doses were taken.',
    defaultCategories: ['MEDICATIONS', 'ADHERENCE'],
    defaultDurationDays: 365,
    abdmPurposeCode: 'CAREMGT',
    isActive: true,
  },
  {
    code: 'LAB_REVIEW',
    name: 'Lab result review',
    description: 'Your care team can review your lab results and trends.',
    defaultCategories: ['LABS'],
    defaultDurationDays: 365,
    abdmPurposeCode: 'CAREMGT',
    isActive: true,
  },
  {
    code: 'AI_ASSISTANCE',
    name: 'AI-assisted summaries for your clinician',
    description:
      'An AI assistant may summarise your recorded data for your clinician. It never diagnoses or changes treatment.',
    defaultCategories: [
      'ENCOUNTERS',
      'CONDITIONS',
      'ALLERGIES',
      'MEDICATIONS',
      'ADHERENCE',
      'LABS',
      'VITALS',
      'ACTIVITY',
    ],
    defaultDurationDays: 365,
    abdmPurposeCode: null,
    isActive: true,
  },
  {
    code: 'CAREGIVING',
    name: 'Family caregiver access',
    description: 'A family member you choose can help with reminders. Coming in next phase.',
    defaultCategories: ['MEDICATIONS', 'ADHERENCE', 'APPOINTMENTS'],
    defaultDurationDays: 180,
    abdmPurposeCode: null,
    isActive: false,
  },
  {
    code: 'EMERGENCY_ACCESS',
    name: 'Emergency (break-glass) access',
    description: 'Time-limited access in an emergency, always audited. Coming in next phase.',
    defaultCategories: ['DEMOGRAPHICS', ...CLINICAL],
    defaultDurationDays: 1,
    abdmPurposeCode: 'BTG',
    isActive: false,
  },
] satisfies {
  code: string;
  name: string;
  description: string;
  defaultCategories: DataCategory[];
  defaultDurationDays: number;
  abdmPurposeCode: string | null;
  isActive: boolean;
}[];
export const purposeId = (code: string): string => seedId(`purpose:${code}`);

/**
 * Default role → category access (Security §4.2). Organization admins,
 * auditors and platform admins have no clinical access at all.
 */
export const DEFAULT_ACCESS_POLICY: {
  role: MemberRole;
  categories: DataCategory[];
  actions: AccessAction[];
  requiresCareRelationship: boolean;
  description: string;
}[] = [
  {
    role: 'DOCTOR',
    categories: ['DEMOGRAPHICS'],
    actions: ['READ'],
    requiresCareRelationship: false,
    description: 'Doctors can find any patient of their organization.',
  },
  {
    role: 'DOCTOR',
    categories: CLINICAL,
    actions: ['READ', 'CREATE', 'UPDATE', 'SIGN'],
    requiresCareRelationship: true,
    description: 'Doctors see clinical data of patients in their care, with consent.',
  },
  {
    role: 'NURSE',
    categories: ['DEMOGRAPHICS'],
    actions: ['READ'],
    requiresCareRelationship: false,
    description: 'Nurses can find patients of their organization.',
  },
  {
    role: 'NURSE',
    categories: ['ALLERGIES', 'MEDICATIONS', 'ADHERENCE', 'VITALS', 'CARE_PLAN', 'APPOINTMENTS'],
    actions: ['READ', 'CREATE'],
    requiresCareRelationship: false,
    description: 'Nurses support care with consent.',
  },
  {
    role: 'CARE_COORDINATOR',
    categories: ['DEMOGRAPHICS'],
    actions: ['READ'],
    requiresCareRelationship: false,
    description: 'Care coordinators can find patients of their organization.',
  },
  {
    role: 'CARE_COORDINATOR',
    categories: ['ADHERENCE', 'CARE_PLAN', 'APPOINTMENTS'],
    actions: ['READ', 'CREATE', 'UPDATE'],
    requiresCareRelationship: false,
    description: 'Care coordinators handle follow-ups and appointments, with consent.',
  },
  {
    role: 'FRONT_DESK',
    categories: ['DEMOGRAPHICS', 'APPOINTMENTS'],
    actions: ['READ'],
    requiresCareRelationship: false,
    description: 'Front desk manages the schedule only.',
  },
];
