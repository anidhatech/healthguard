import type { DbClient } from './create-client.js';

/** Every model that carries `organizationId` and belongs to exactly one tenant. */
export const TENANT_MODELS = new Set([
  'OrganizationMember',
  'ClinicianProfile',
  'PatientProfile',
  'Encounter',
  'Condition',
  'Allergy',
  'Procedure',
  'Immunization',
  'MedicationPlan',
  'MedicationInstruction',
  'MedicationDoseEvent',
  'LabResult',
  'Vital',
  'ActivityMetric',
  'Document',
  'CarePlan',
  'FollowUp',
  'Appointment',
  'Consent',
  'Notification',
  'AIInteraction',
  'AIRecommendation',
  'SourceProvenance',
]);

const WHERE_OPERATIONS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'delete',
  'deleteMany',
  'upsert',
]);

export class TenantViolationError extends Error {
  constructor(model: string, organizationId: unknown) {
    super(`Tenant violation: ${model} write for organization ${String(organizationId)}`);
    this.name = 'TenantViolationError';
  }
}

type Args = Record<string, unknown> & { where?: Record<string, unknown>; data?: unknown };

/** Adds the tenant filter to reads and checks the tenant on writes. */
export function scopeArgs(
  model: string,
  operation: string,
  args: Args,
  organizationId: string,
): Args {
  if (!TENANT_MODELS.has(model)) return args;
  const scoped: Args = { ...args };
  if (WHERE_OPERATIONS.has(operation)) {
    scoped.where = { ...(args.where ?? {}), organizationId };
  }
  const checkRow = (row: unknown) => {
    if (row && typeof row === 'object') {
      const value = (row as Record<string, unknown>).organizationId;
      if (value !== undefined && value !== organizationId)
        throw new TenantViolationError(model, value);
    }
  };
  if (operation === 'create' || operation === 'createMany' || operation === 'createManyAndReturn') {
    const data = args.data;
    const rows = Array.isArray(data) ? data : [data];
    for (const row of rows) checkRow(row);
    scoped.data = Array.isArray(data)
      ? data.map((row: Record<string, unknown>) => ({ ...row, organizationId }))
      : { ...(data as Record<string, unknown>), organizationId };
  }
  if (operation === 'update' || operation === 'updateMany' || operation === 'upsert') {
    checkRow(args.data);
    if (operation === 'upsert') checkRow(args.create);
  }
  return scoped;
}

export function forTenant(db: DbClient, organizationId: string) {
  return db.$extends({
    name: 'tenant-scope',
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          return query(scopeArgs(model, operation, args, organizationId));
        },
      },
    },
  });
}

export type TenantClient = ReturnType<typeof forTenant>;
