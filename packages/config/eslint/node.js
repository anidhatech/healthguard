// ESLint config for Node.js packages and the NestJS API.
import globals from 'globals';
import { typescriptConfig } from './base.js';

/** @param {{ tsconfigRootDir: string }} options */
export function nodeConfig({ tsconfigRootDir }) {
  return typescriptConfig({
    tsconfigRootDir,
    extra: [
      {
        languageOptions: { globals: { ...globals.node } },
      },
    ],
  });
}
