// ESLint config for the Next.js web app: Next's core-web-vitals rules plus
// the shared type-aware TypeScript rules.
import nextVitals from 'eslint-config-next/core-web-vitals';
import globals from 'globals';
import { typescriptConfig } from './base.js';

/** @param {{ tsconfigRootDir: string }} options */
export function nextConfig({ tsconfigRootDir }) {
  return typescriptConfig({
    tsconfigRootDir,
    extra: [
      ...nextVitals,
      {
        languageOptions: { globals: { ...globals.browser, ...globals.node } },
        rules: {
          'react/react-in-jsx-scope': 'off',
        },
      },
    ],
  });
}
