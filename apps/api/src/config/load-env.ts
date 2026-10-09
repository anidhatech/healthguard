import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Local runs read the repository's root `.env`; real environment variables win. */
export function loadRootEnv(): void {
  const candidates = [
    fileURLToPath(new URL('../../../../.env', import.meta.url)),
    `${process.cwd()}/.env`,
  ];
  for (const file of candidates) {
    if (existsSync(file)) {
      process.loadEnvFile(file);
      return;
    }
  }
}
