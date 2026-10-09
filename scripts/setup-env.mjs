#!/usr/bin/env node
// Creates `.env` from `.env.example` with a fresh Ed25519 JWT key pair and a
// random identifier-hash key. Never overwrites an existing `.env`.
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const target = `${root}.env`;
const example = `${root}.env.example`;

if (existsSync(target)) {
  console.log('.env already exists; leaving it unchanged.');
  process.exit(0);
}
copyFileSync(example, target);

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const b64 = (pem) => Buffer.from(pem).toString('base64');
const values = {
  JWT_PRIVATE_KEY: b64(privateKey.export({ type: 'pkcs8', format: 'pem' })),
  JWT_PUBLIC_KEY: b64(publicKey.export({ type: 'spki', format: 'pem' })),
  IDENTIFIER_HASH_KEY: randomBytes(32).toString('base64url'),
};
let content = readFileSync(target, 'utf8');
for (const [key, value] of Object.entries(values)) {
  content = content.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${value}`);
}
writeFileSync(target, content, { mode: 0o600 });
console.log(
  'Created .env with fresh JWT keys. Add ANTHROPIC_API_KEY there if you want live Claude output.',
);
