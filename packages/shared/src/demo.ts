/**
 * Synthetic demo accounts. Every person here is fictional. The seed creates
 * them, and the demo quick-login lists them only when demo authentication is
 * enabled. Organization names are the seeded synthetic tenants.
 */
export const DEMO_ORGANIZATIONS = {
  medicalCenter: {
    slug: 'healthguard-demo-medical-center',
    name: 'HealthGuard Demo Medical Center',
  },
  lakeview: {
    slug: 'lakeview-demo-hospital',
    name: 'Lakeview Demo Hospital',
  },
} as const;

export interface DemoAccount {
  key: string;
  email: string;
  displayName: string;
  persona: string;
  organizationName: string;
  description: string;
  /** Shown first on the login page. */
  primary: boolean;
}

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    key: 'patient',
    email: 'patient@healthguard.demo',
    displayName: 'Ananya Rao',
    persona: 'Patient',
    organizationName: DEMO_ORGANIZATIONS.medicalCenter.name,
    description: 'Primary demo patient. Type 2 diabetes and hypertension; prefers Telugu.',
    primary: true,
  },
  {
    key: 'doctor',
    email: 'doctor@healthguard.demo',
    displayName: 'Dr. Meera Sharma',
    persona: 'Doctor',
    organizationName: DEMO_ORGANIZATIONS.medicalCenter.name,
    description: "Internal medicine. Ananya's primary clinician.",
    primary: true,
  },
  {
    key: 'admin',
    email: 'admin@healthguard.demo',
    displayName: 'Kavya Iyer',
    persona: 'Organization admin',
    organizationName: DEMO_ORGANIZATIONS.medicalCenter.name,
    description: 'Manages members and settings. Sees no clinical data.',
    primary: true,
  },
  {
    key: 'doctor-arjun',
    email: 'arjun.reddy@healthguard.demo',
    displayName: 'Dr. Arjun Reddy',
    persona: 'Doctor',
    organizationName: DEMO_ORGANIZATIONS.medicalCenter.name,
    description: "Same clinic, not in Ananya's care: shows a consent-aware denial.",
    primary: false,
  },
  {
    key: 'care-team',
    email: 'care@healthguard.demo',
    displayName: 'Ravi Kumar',
    persona: 'Care team (care coordinator)',
    organizationName: DEMO_ORGANIZATIONS.medicalCenter.name,
    description: 'Handles call-backs, follow-ups and appointments.',
    primary: false,
  },
  {
    key: 'patient-rahul',
    email: 'rahul.mehta@healthguard.demo',
    displayName: 'Rahul Mehta',
    persona: 'Patient',
    organizationName: DEMO_ORGANIZATIONS.medicalCenter.name,
    description: "Hypertension. Dr. Arjun Reddy's patient; prefers Hindi.",
    primary: false,
  },
  {
    key: 'patient-priya',
    email: 'priya.nair@healthguard.demo',
    displayName: 'Priya Nair',
    persona: 'Patient',
    organizationName: DEMO_ORGANIZATIONS.medicalCenter.name,
    description: 'Hypothyroidism. Short history; prefers English.',
    primary: false,
  },
  {
    key: 'platform-admin',
    email: 'platform@healthguard.demo',
    displayName: 'Platform Admin',
    persona: 'Platform admin',
    organizationName: 'HealthGuard platform',
    description: 'Tenant provisioning view. Sees no clinical data.',
    primary: false,
  },
  {
    key: 'lakeview-doctor',
    email: 'lakeview.doctor@healthguard.demo',
    displayName: 'Dr. Sameer Khan',
    persona: 'Doctor (another organization)',
    organizationName: DEMO_ORGANIZATIONS.lakeview.name,
    description: 'Works at a different organization: proves tenant isolation.',
    primary: false,
  },
];

export function findDemoAccount(email: string): DemoAccount | undefined {
  const normalized = email.trim().toLowerCase();
  return DEMO_ACCOUNTS.find((account) => account.email === normalized);
}
