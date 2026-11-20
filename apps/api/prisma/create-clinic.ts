/**
 * `pnpm --filter @healthguard/api db:create-clinic`: creates a clinic
 * organization and one front-desk user to sign in as, for pilot or sandbox
 * work with real identities. It is the opposite of the demo seed: it refuses
 * to run in demo mode or in a database that holds demo organizations, so real
 * and synthetic records never share a database.
 *
 * Settings, all optional, from the environment:
 *   CLINIC_NAME    default "Sandbox Test Clinic"
 *   CLINIC_SLUG    default made from the name
 *   DESK_EMAIL     default "desk@clinic.local"
 *   DESK_NAME      default "Front Desk"
 *   DESK_PASSWORD  default: a random one, printed once
 *
 * It also loads the default access rules and consent purposes, which every
 * organization needs. Running it again for the same email sets a new password.
 */
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { hash } from '@node-rs/argon2';
import { createPrismaClient } from '../src/infrastructure/prisma/create-client.js';
import { seedAccessDefaults } from '../src/modules/demo/seed/run.js';

const rootEnv = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const print = (line: string) => process.stdout.write(`${line}\n`);

async function main(): Promise<void> {
  if (process.env.DEMO_MODE === 'true') {
    throw new Error('Refusing to create a clinic with DEMO_MODE=true. Run with DEMO_MODE=false.');
  }
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const name = process.env.CLINIC_NAME?.trim() || 'Sandbox Test Clinic';
  const slug =
    process.env.CLINIC_SLUG?.trim() ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  const email = (process.env.DESK_EMAIL?.trim() || 'desk@clinic.local').toLowerCase();
  const displayName = process.env.DESK_NAME?.trim() || 'Front Desk';
  const generated = !process.env.DESK_PASSWORD;
  const password = process.env.DESK_PASSWORD ?? randomBytes(12).toString('base64url');
  if (password.length < 12) throw new Error('DESK_PASSWORD must be at least 12 characters.');

  const db = createPrismaClient(url);
  try {
    const demoOrganizations = await db.organization.count({ where: { isDemo: true } });
    if (demoOrganizations > 0) {
      throw new Error(
        'This database holds demo organizations. Use a separate database for real records.',
      );
    }
    // Without the default access rules, staff could not open any patient record.
    await seedAccessDefaults(db);
    const organization = await db.organization.upsert({
      where: { slug },
      update: {},
      create: { slug, name, type: 'CLINIC', isDemo: false },
    });
    if (organization.isDemo) throw new Error(`"${slug}" is a demo organization.`);
    const passwordHash = await hash(password);
    const user = await db.user.upsert({
      where: { email },
      update: { passwordHash, status: 'ACTIVE', failedLoginCount: 0, lockedUntil: null },
      create: { email, displayName, passwordHash },
    });
    await db.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: organization.id, userId: user.id } },
      update: { status: 'ACTIVE' },
      create: {
        organizationId: organization.id,
        userId: user.id,
        roles: ['FRONT_DESK'],
        status: 'ACTIVE',
        joinedAt: new Date(),
      },
    });
    print(`Clinic: ${organization.name} (${organization.slug})`);
    print(`Front-desk sign-in: ${email}`);
    print(
      generated
        ? `Password (shown once, keep it to yourself): ${password}`
        : 'Password: the DESK_PASSWORD you set',
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
