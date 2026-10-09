import { z } from 'zod';
import { SUPPORTED_LOCALES } from '../locales.js';
import { MEMBER_ROLES, PATIENT_ROLE, PLATFORM_ADMIN_ROLE } from '../roles.js';
import { IsoDateTimeSchema, UuidSchema } from './common.js';

const EmailSchema = z.email().max(254);

export const DemoLoginRequestSchema = z.strictObject({
  email: EmailSchema,
  /** Development tools only: also return a short-lived bearer token in the body. */
  issueBearerToken: z.boolean().optional(),
});
export type DemoLoginRequest = z.infer<typeof DemoLoginRequestSchema>;

export const PasswordLoginRequestSchema = z.strictObject({
  email: EmailSchema,
  password: z.string().min(1).max(200),
});
export type PasswordLoginRequest = z.infer<typeof PasswordLoginRequestSchema>;

export const SwitchOrganizationRequestSchema = z.strictObject({
  organizationId: UuidSchema,
});
export type SwitchOrganizationRequest = z.infer<typeof SwitchOrganizationRequestSchema>;

export const UpdateLocaleRequestSchema = z.strictObject({
  preferredLocale: z.enum(SUPPORTED_LOCALES),
});
export type UpdateLocaleRequest = z.infer<typeof UpdateLocaleRequestSchema>;

const SessionRoleSchema = z.enum([...MEMBER_ROLES, PATIENT_ROLE, PLATFORM_ADMIN_ROLE]);

export const OrganizationRefSchema = z.object({
  id: UuidSchema,
  name: z.string(),
  slug: z.string(),
  type: z.enum(['CLINIC', 'HOSPITAL']),
  isDemo: z.boolean(),
});
export type OrganizationRef = z.infer<typeof OrganizationRefSchema>;

export const SessionViewSchema = z.object({
  user: z.object({
    id: UuidSchema,
    email: z.string().nullable(),
    displayName: z.string(),
    preferredLocale: z.enum(SUPPORTED_LOCALES),
  }),
  roles: z.array(SessionRoleSchema),
  activeOrganization: OrganizationRefSchema.nullable(),
  memberships: z.array(
    z.object({
      organization: OrganizationRefSchema,
      roles: z.array(z.enum(MEMBER_ROLES)),
    }),
  ),
  patientProfiles: z.array(
    z.object({
      id: UuidSchema,
      displayName: z.string(),
      organization: OrganizationRefSchema,
    }),
  ),
  homeArea: z.enum(['patient', 'doctor', 'admin']),
  authMethod: z.enum(['DEMO_QUICK_LOGIN', 'PASSWORD', 'OIDC']),
  demoMode: z.boolean(),
  accessTokenExpiresAt: IsoDateTimeSchema,
  /** Present only when a development tool asked for it at demo login. */
  accessToken: z.string().optional(),
});
export type SessionView = z.infer<typeof SessionViewSchema>;

export const DemoAccountsResponseSchema = z.object({
  enabled: z.boolean(),
  notice: z.string(),
  passwordLoginEnabled: z.boolean(),
  accounts: z.array(
    z.object({
      key: z.string(),
      email: z.string(),
      displayName: z.string(),
      persona: z.string(),
      organizationName: z.string(),
      description: z.string(),
      primary: z.boolean(),
    }),
  ),
});
export type DemoAccountsResponse = z.infer<typeof DemoAccountsResponseSchema>;
